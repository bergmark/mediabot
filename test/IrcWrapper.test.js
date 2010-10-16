require('IrcWrapper');
var sys = require('sys');
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
        }
    }
});

module.exports = {
    "event binding test" : function (assert) {
        var person = {
            nick : 'thenick',
            user : 'theuser',
            host : 'thehost'
        }

        var triggers = 0;
        var msg3Msg = null;
        var fooTestHash = null;
        var locationHash = null;
        var hashes = {};
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
                }, {
                    location : "#chan2",
                    callback : function (h) {
                        locationHash = h;
                    }
                }, {
                    location : "#chanx",
                    messageString : "msgx",
                    messageRegExp : /msgx/,
                    callback : function (h) {
                        hashes.x = h;
                    }
                }],
                join : [{
                    channel : "#joinchan",
                    callback : function (h) {
                        hashes.join = h;
                    }
                }]
            }
        });

        // Match message.
        var ircMock = iw.getIrc();
        ircMock.privmsg("#chan", "msg", person);
        assert.eql(1, triggers);
        ircMock.privmsg("#chan", "msg2", person);
        assert.eql(1, triggers);

        assert.eql(null, msg3Msg);
        ircMock.privmsg("#chan", "msg3", person);
        assert.eql("msg3", msg3Msg);

        // Match message with regex.
        assert.eql(null, fooTestHash);
        ircMock.privmsg("#chan", "foo", person);
        assert.eql("foo", fooTestHash.message);
        ircMock.privmsg("#chan", "bar foo baz", person);
        assert.eql("bar foo baz", fooTestHash.message);
        assert.eql("foo", fooTestHash.regExp[1]);
        assert.ok(!(2 in fooTestHash.regExp));

        // Match with location.
        assert.isNull(locationHash);
        ircMock.privmsg("#chan2", "some msg", person);
        assert.eql("#chan2", locationHash.location);
        assert.eql("some msg", locationHash.message);

        assert.isUndefined(hashes.x);
        ircMock.privmsg("#chanx", "msgx msgx msgx", person); // messageString not matching
        assert.isUndefined(hashes.x);
        ircMock.privmsg("#chanxx", "msgx", person); // location not matching
        assert.isUndefined(hashes.x);
        ircMock.privmsg("#chanx", "msgx", person);
        assert.isDefined(hashes.x);

        // Listen for joins.
        ircMock.join("#joinchan", person);
        assert.isDefined(hashes.join);
        assert.eql("#joinchan", hashes.join.location);

        // Listen for arbitrary raws.
        assert.isUndefined(hashes.arbitrary);
        var triggered = false;
        iw._addListener("arbitrary", function () {
            triggered = true;
        });
        ircMock.sendRaw("arbitrary");
        assert.ok(triggered);

        // Listen for parts.
        var hash = null;
        iw._onpart({
            channel : "#partchan",
            callback : function (h) {
                hash = h;
            }
        });
        ircMock.join("#partchan", person);
        ircMock.part("#partchan", person);
        assert.eql("#partchan", hash.location);
    },
    "Channel management test" : function (assert) {
        var mehash = {
            nick : 'me',
            user : 'meuser',
            host : 'mehost'
        };
        var otherhash = {
            nick : 'other',
            user : 'otheruser',
            host : 'otherhost'
        };

        var iw = new IrcWrapper({
            IRC : IRCMock,
            server : "my.server",
            nick : mehash.nick,
            joinChannels : ["#my-join-chan"]
        });
        var irc = iw.getIrc();
        irc.send001(mehash.nick);

        // Join a channel and assert that IrcWrapper knows about it.
        irc.join("#my-join-chan", mehash);
        var chan = iw.getChannel('#my-join-chan');
        assert.eql("#my-join-chan", chan.getName());
        irc.join("#my-join-chan", otherhash);
        // Don't create several instances.
        assert.strictEqual(chan, iw.getChannel('#my-join-chan'));

        // Store users in channels.
        var chan = iw.getChannel('#my-join-chan');
        assert.eql(2, chan.getPeopleCount());
        assert.isNotNull(chan.getPeople()[0]);
        var me = iw.getPerson('me');
        var other = iw.getPerson('other');
        assert.ok(me !== other);
        irc.join('#chan2', mehash);
        var chan2 = iw.getChannel('#chan2');
        assert.ok(iw.getChannel('#chan2').hasPerson(me));
        assert.strictEqual(me, iw.getPerson('me'));
        assert.eql(2, iw.getPerson('me').getChannelCount());
        assert.ok(me.isInChannel(chan2));
        assert.ok(chan2.hasPerson(me));
        assert.ok(!other.isInChannel(chan2));
        assert.ok(!chan2.hasPerson(other));

        irc.part('#my-join-chan', other);
        assert.ok(!chan.hasPerson(other));
        assert.ok(!other.isInChannel(chan));

        // Me.
        assert.ok(me === iw.getMe());
        // make sure user and host is set.
        assert.eql(mehash.user, iw.getMe().getUser());
        assert.eql(mehash.host, iw.getMe().getHost());
    }
};
