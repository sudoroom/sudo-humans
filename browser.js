var http = require('http');
var persona = require('persona-id')();

persona.on('login', function (id) {
    button.value = 'unidentify';
    whoami.textContent = id;
});

persona.on('logout', function () {
    button.value = 'identify';
    whoami.textContent = '';
});

var button = document.getElementById('identify');
var whoami = document.getElementById('whoami');

var who = whoami.textContent;
persona.set(who);

button.addEventListener('click', function () {
    if (!persona.id) {
        persona.identify();
    }
    else persona.unidentify();
});
