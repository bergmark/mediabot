var joose = require('Joose');

joose.Class("IrcWrapper", {
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
                    irc.join(this.joinChannels[i]);
                }
            }.bind(this));
            for (var i = 0; i < this.bindings.privmsg.length; i++) {
                var v = this.bindings.privmsg[i];
                this._onPrivmsgMatching(v);
            }
            for (var i = 0; i < this.bindings.join.length; i++) {
                var v = this.bindings.join[i];
                this._onJoinMatching(v);
            }
        },
        _onPrivmsg : function (callback) {
            this.irc.addListener("privmsg", function (e) {
                var location = e.params[0];
                callback({
                    person : e.person,
                    location : location,
                    message : e.params[1],
                    reply : this.irc.privmsg.bind(this.irc, location),
                    regExp : null,
                    e : e
                });
            }.bind(this));
        },
        _onPrivmsgMatching : function (options) {
            this._onPrivmsg(function (h) {
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
        _onJoin : function (callback) {
            this.irc.addListener("join", function (e) {
                var location = e.params[0];
                callback({
                    person : e.person,
                    location : location,
                    reply : this.irc.privmsg.bind(this.irc, location),
                    e : e
                });
            }.bind(this));
        },
        _onJoinMatching : function (options) {
            this._onJoin(function (h) {
                if ("channel" in options && options.channel !== h.location) {
                    return;
                }
                options.callback.call(this, h);
            });
        },
        addArbitraryListener : function (raw, callback) {
            this.irc.addListener(raw, function (e) {
                callback({});
            });
        }
    }
});
