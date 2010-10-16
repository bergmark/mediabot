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
        _addListener : function (raw, callback) {
            var that = this;
            this.irc.addListener(raw, function (e) {
                callback(that._parseE(raw, e));
            });
        },
        _parseE : function (raw, e) {
            var h = {
                e : e
            };
            if (raw === "join") {
                var location = e.params[0];
                h.person = e.person;
                h.location = location;
                h.reply = this.irc.privmsg.bind(this.irc, location);
            } else if (raw === "privmsg") {
                var location = e.params[0];
                h.person = e.person;
                h.location = location;
                h.message = e.params[1];
                h.reply = this.irc.privmsg.bind(this.irc, location);
                h.regExp = null;
            }
            return h;
        },
        _onPrivmsgMatching : function (options) {
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
        _onJoinMatching : function (options) {
            this._addListener("join", function (h) {
                if ("channel" in options && options.channel !== h.location) {
                    return;
                }
                options.callback.call(this, h);
            });
        }
    }
});
