var joose = require('Joose');

var Person = joose.Class('Person', {
    has : {
        nick : {
            is : "ro"
        },
        user : {
            is : "ro"
        },
        host : {
            is : "ro"
        },
        channels : {
            is : "ro",
            init : function () { return []; }
        }
    },
    methods : {
        addChannel : function (channel) {
            this.channels.push(channel);
        }
    }
});
