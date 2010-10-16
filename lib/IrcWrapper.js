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
        }
    },
    methods : {
        initialize : function (args) {
            this.bindings.privmsg = this.bindings.privmsg || [];
            this.irc = new args.IRC({
                server : this.server,
                nick : this.nick
            });
            this.irc.connect(function () {
                for (var i = 0; i < this.joinChannels.length; i++) {
                    this.irc.join(this.joinChannels[i]);
                }
            }.bind(this));
            for (var p in this.bindings) if (this.bindings.hasOwnProperty(p)) {
                var raw = p;
                var v = this.bindings[p];
                if ("_on" + raw in this) {
                    for (var i = 0; i < v.length; i++) {
                        this["_on" + raw](v[i]);
                    }
                } else {
                    for (var i = 0; i < v.length; i++) {
                        this._addListener(raw, v[i]);
                    }
                }
            }

            var that = this;
            this._onjoin({
                callback : function (h) {
                    if (!(h.location in that.channels)) {
                        that.channels[h.location] = new Channel({
                            name : h.location
                        });
                    }
                    var channel = that.channels[h.location];
                    channel.addPerson(h.person);
                    h.person.addChannel(channel);
                }
            });
        },
        _addListener : function (raw, callback) {
            var that = this;
            this.irc.addListener(raw, function (e) {
                var x = that._parseE(raw, e);
                callback(x);
            });
        },
        _parseE : function (raw, e) {
            var h = {
                e : e
            };
            if (raw === "join" || raw === "part") {
                var location = e.params[0];
                h.person = this._personCreate({
                    nick : e.person.nick,
                    user : e.person.user,
                    host : e.person.host
                });
                h.location = location;
                h.reply = this.irc.privmsg.bind(this.irc, location);
            } else if (raw === "privmsg") {
                var location = e.params[0];
                h.person = this._personCreate({
                    nick : e.person.nick,
                    user : e.person.user,
                    host : e.person.host
                });
                h.location = location;
                h.message = e.params[1];
                h.reply = this.irc.privmsg.bind(this.irc, location);
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
        getPerson : function (nick) {
            if (!(nick in this.people)) {
                throw new Error("IrcWrapper:getPerson: No user by the name " + nick);
            }
            return this._getPerson(nick);
        },
        _getPerson : function (nick) {
            return this.people[nick];
        },
        _personCreate : function (values) {
            if (this._getPerson(values.nick)) {
                return this._getPerson(values.nick);
            }
            var p = new Person(values);
            this.people[p.getNick()] = p;
            return p;
        }
    }
});

module.exports = IrcWrapper;
