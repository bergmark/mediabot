var joose = require('Joose');
require('./Channel');
require('./Person');

IrcWrapper = joose.Class("IrcWrapper", {
    has : {
        server : {},
        irc : {
            is : "ro"
        },
        nick : null,
        joinChannels : {
            init : function () { return []; }
        },
        bindings : {
            init : function () { return {}; }
        },
        channels : {
            is : "ro",
            init : function () { return {}; }
        },
        people : {
            is : "ro",
            init : function () { return {}; }
        },
        me : {
            is : "ro"
        }
    },
    methods : {
        initialize : function (args) {
            this.bindings.join = this.bindings.join || [];
            this.bindings.privmsg = this.bindings.privmsg || [];
            this.bindings.part = this.bindings.part || [];
            this.bindings.quit = this.bindings.quit || [];
            this.bindings['001'] = this.bindings['001'] || [];
            this.irc = new args.IRC({
                server : this.server,
                nick : this.nick
            });

            this.bindings.join.push({
                callback : function (h) {
                    if (!(h.location in this.channels)) {
                        this._addChannel(new Channel({
                            name : h.location
                        }));
                    }
                    var channel = this.channels[h.location];
                    channel.addPerson(h.person);
                    h.person.addChannel(channel);
                }.bind(this)
            });
            this.bindings['001'].push({
                callback : function (h) {
                    this.me = this._personCreate({
                        nick : h.nick
                    });
                }.bind(this)
            });
            this.bindings.part.push({
                callback : function (h) {
                    var channel = this.getChannel(h.location);
                    var person = h.person;
                    channel.removePerson(person);
                    person.removeChannel(channel);

                    // If bot parts, remove channel from memory.
                    if (this.getMe() === person) {
                        this._removeChannel(channel);
                    }
                }.bind(this)
            });
            this.bindings.quit.push({
                callback : function (h) {
                    var channel = this.getChannel(h.location);
                    var person = h.person;
                    channel.removePerson(person);
                    person.removeChannel(channel);

                    // If bot parts, remove channel from memory.
                    if (this.getMe() === person) {
                        this._removeChannel(channel);
                    }
                }.bind(this)
            });

            // Apply bindings.
            for (var p in this.bindings) if (this.bindings.hasOwnProperty(p)) {
                var raw = p;
                var v = this.bindings[p];
                if ("_on" + raw in this) {
                    for (var i = 0; i < v.length; i++) {
                        this["_on" + raw](v[i]);
                    }
                } else {
                    for (var i = 0; i < v.length; i++) {
                        this._addListener(raw, v[i].callback);
                    }
                }
            }

            this.irc.connect(function () {
                for (var i = 0; i < this.joinChannels.length; i++) {
                    this.irc.join(this.joinChannels[i]);
                }
            }.bind(this));
        },
        _addListener : function (raw, callback) {
            if (!(callback instanceof Function)) {
                throw new Error("_addListener: callback must be a function.");
            }
            this.irc.addListener(raw, function (e) {
                var x = this._parseE(raw, e);
                callback(x);
            }.bind(this));
        },
        _parseE : function (raw, e) {
            var h = {
                e : e
            };
            if (raw === "001") {
                h.nick = e.params[0];
                h.welcomeMessage = e.params[1];
            }
            if (raw === "join" || raw === "part" || raw === "quit" || raw === "privmsg") {
                var location = e.params[0];
                h.person = this._personCreate({
                    nick : e.person.nick,
                    user : e.person.user,
                    host : e.person.host
                });
                h.location = location;
                h.reply = this.irc.privmsg.bind(this.irc, location);
            }
            if (raw === "privmsg") {
                h.message = e.params[1];
                h.regExp = null;
            }
            return h;
        },
        _onprivmsg : function (options) {
            this._addListener("privmsg", function (h) {
                if ("location" in options && options.location !== h.location) {
                    return;
                }
                if ("messageString" in options && options.messageString !== h.message) {
                    return;
                }
                if ("messageRegExp" in options) {
                    h.regExp = options.messageRegExp.exec(h.message);
                    if (h.regExp === null) {
                        return;
                    }
                }
                options.callback.call(this, h);
            });
        },
        _onjoin : function (options) {
            this._addListener("join", function (h) {
                if ("channel" in options && options.channel !== h.location) {
                    return;
                }
                options.callback.call(this, h);
            });
        },
        _onpart : function (options) {
            this._addListener("part", function (h) {
                if ("channel" in options && options.channel !== h.location) {
                    return;
                }
                options.callback.call(this, h);
            });
        },
        getChannel : function (name) {
            if (!(name in this.channels)) {
                throw new Error("IrcWrapper:getChannel: No channel with name: " + name);
            }
            return this._getChannel(name);
        },
        _removeChannel : function (channel) {
            delete this.channels[channel.getName()];
        },
        _addChannel : function (channel) {
            this.channels[channel.getName()] = channel;
        },
        _getChannel : function (name) {
            return this.channels[name];
        },
        getPerson : function (nick) {
            if (!(nick in this.people)) {
                throw new Error("IrcWrapper:getPerson: No user with nick: " + nick);
            }
            return this._getPerson(nick);
        },
        _getPerson : function (nick) {
            return this.people[nick];
        },
        _personCreate : function (values) {
            if (this._getPerson(values.nick)) {
                var p = this._getPerson(values.nick);
                if (values.user) {
                    p.setUser(values.user);
                }
                if (values.host) {
                    p.setHost(values.host);
                }
                return p;
            } else {
                var p = new Person(values);
                this.people[p.getNick()] = p;
                return p;
            }
        },
        getMe : function () {
            return this.me;
        }
    }
});

module.exports = IrcWrapper;
