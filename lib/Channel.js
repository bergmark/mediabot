var joose = require('Joose');

var Channel = joose.Class("Channel", {
    has : {
        name : {
            is : "ro"
        },
        people : {
            is : "ro",
            init : function () { return []; }
        }
    },
    methods : {
        addPerson : function (person) {
            this.people.push(person);
        }
    }
});
