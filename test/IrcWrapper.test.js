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
        ircMock.part("#partchan", person);
        assert.eql("#partchan", hash.location);
    },
    "Channel management test" : function (assert) {
        var iw = new IrcWrapper({
            IRC : IRCMock,
            server : "my.server",
            nick : "mynick",
            joinChannels : ["#my-join-chan"],
        });
        var me = {
            nick : 'me',
            user : 'meuser',
            host : 'mehost'
        };
        var other = {
            nick : 'other',
            user : 'otheruser',
            host : 'otherhost'
        };

        // Join a channel and assert that IrcWrapper knows about it.
        var irc = iw.getIrc();
        irc.join("#my-join-chan", me);
        var chan = iw.getChannels()['#my-join-chan'];
        assert.eql("#my-join-chan", chan.getName());
        irc.join("#my-join-chan", other);
        // Don't create several instances.
        assert.strictEqual(chan, iw.getChannels()['#my-join-chan']);

        // Store users in channels.
        var chan = iw.getChannels()['#my-join-chan'];
        var people = chan.getPeople();
        assert.eql(2, people.length);
        assert.isNotNull(people[0]);
        var me = people[0].getNick() === 'me' ? people[0] : people[1];
        var other = people[0].getNick() === 'me' ? people[1] : people[0];
        assert.ok(me !== other);
        irc.join('#chan2', me);
        assert.strictEqual(me, iw.getChannels()['#chan2'].getPeople()[0]);
        assert.strictEqual(me, iw.getPerson('me'));
        assert.eql(2, iw.getPerson('me').getChannels().length);
    }
};
