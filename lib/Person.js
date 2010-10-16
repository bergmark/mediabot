var joose = require('Joose');

var Person = joose.Class('Person', {
    has : {
        nick : {
            is : "rw"
        },
        user : {
            is : "rw"
        },
        host : {
            is : "rw"
        },
        channels : {
            is : "ro",
            init : function () { return {}; }
        }
    },
    methods : {
        addChannel : function (channel) {
            this.channels[channel.getName()] = channel;
        },
        isInChannel : function (channel) {
            return this.channels[channel.getName()];
        },
        removeChannel : function (channel) {
            delete this.channels[channel.getName()];
        },
        getChannelCount : function () {
            var i = 0;
            for (var p in this.channels) if (this.channels.hasOwnProperty(p)) {
                i++;
            }
            return i;
        },
    }
});
