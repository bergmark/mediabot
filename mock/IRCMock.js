require('Joose');

Class('IRCMock', {
    has : {
        listeners : {
            is : "ro",
            init : function () { return []; }
        }
    },
    methods : {
        connect : function () {

        },
        addListener : function (raw, callback) {
            this.listeners.push({
                raw : raw,
                callback : callback
            });
        },
        sendRaw : function (raw, e) {
            for (var i = 0; i < this.listeners.length; i++) {
                var listener = this.listeners[i];
                if (listener.raw === raw) {
                    listener.callback(e);
                }
            }
        },
        send001 : function (nick) {
            this.sendRaw("001", {
                params : [nick, "Welcome message!"]
            });
        },
        privmsg : function (location, message, person) {
            if (person === undefined) {
                throw new Error("privmsg: need to specify person.");
            }
            this.sendRaw("privmsg", {
                person : person,
                params : [location, message]
            });
        },
        join : function (location, person) {
            if (person === undefined) {
                throw new Error("join: need to specify person.");
            }
            this.sendRaw("join", {
                person : person,
                params : [location]
            });
        },
        part : function (location, person) {
            if (person === undefined) {
                throw new Error("part: need to specify person.");
            }
            this.sendRaw("part", {
                person : person,
                params : [location]
            });
        },
        quit : function (location, person) {
            if (person === undefined) {
                throw new Error("part: need to specify person.");
            }
            this.sendRaw("quit", {
                person : person,
                params : [location, "Quit message!"]
            });
        },
        nick : function (person, newNick) {
            this.sendRaw("nick", {
                person : person,
                command : 'NICK',
                params : [newNick]
            });
        }
    }
});
