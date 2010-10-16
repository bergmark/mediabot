require('IrcWrapper');
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
        privmsg : function (location, message) {
            for (var i = 0; i < this.listeners.length; i++) {
                this.listeners[i].callback({
                    person : null,
                    params : [location, message]
                });
            }
        }
    }
});

module.exports = {
    "Test" : function (assert) {
        var triggers = 0;
        var msg3Msg = null;
        var fooTestHash = null;
        var iw = new IrcWrapper({
            IRC : IRCMock,
            server : "irc.vassius.se",
            nick : "mediabot2",
            joinChannels : ["#c-test"],
            bindings : {
                privmsg : [{
                    messageString : "msg",
                    callback : function (h) {
                        triggers++;
                        assert.eql("msg", h.message);
                        assert.eql("#chan", h.location);
                    }
                }, {
                    messageString : "msg3",
                    callback : function (h) {
                        msg3Msg = h.message;
                    }
                }, {
                    messageRegExp : /(foo)/,
                    callback : function (h) {
                        fooTestHash = h;
                    }
                }]
            }
        });

        var ircMock = iw.getIrc();
        ircMock.privmsg("#chan", "msg");
        assert.eql(1, triggers);
        ircMock.privmsg("#chan", "msg2");
        assert.eql(1, triggers);

        assert.eql(null, msg3Msg);
        ircMock.privmsg("#chan", "msg3");
        assert.eql("msg3", msg3Msg);

        assert.eql(null, fooTestHash);
        ircMock.privmsg("#chan", "foo");
        assert.eql("foo", fooTestHash.message);
        ircMock.privmsg("#chan", "bar foo baz");
        assert.eql("bar foo baz", fooTestHash.message);
        assert.eql("foo", fooTestHash.regExp[1]);
        assert.ok(!(2 in fooTestHash.regExp));
    }
}
