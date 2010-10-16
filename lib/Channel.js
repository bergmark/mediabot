var joose = require('Joose');

var Channel = joose.Class("Channel", {
    has : {
        name : {
            is : "ro"
        },
        people : {
            is : "ro",
            init : function () { return {}; }
        }
    },
    methods : {
        addPerson : function (person) {
            this.people[person.getNick()] = person;
        },
        hasPerson : function (person) {
            return person.getNick() in this.people;
        },
        removePerson : function (person) {
            delete this.people[person.getNick()];
        },
        getPeopleCount : function () {
            var i = 0;
            for (var p in this.people) if (this.people.hasOwnProperty(p)) {
                i++;
            }
            return i;
        }
    }
});
