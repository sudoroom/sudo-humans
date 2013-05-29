var http = require('http');
var persona = require('persona-id')();

persona.on('login', function (id) {
    button.value = 'sign out';
    name.textContent = id;
    
    auth.classList.add('hide');
    member.classList.remove('hide');
});

persona.on('logout', function () {
    button.value = 'authenticate';
    name.textContent = '';
    
    auth.classList.remove('hide');
    member.classList.add('hide');
});

var button = document.getElementById('identify');
var name = document.getElementById('name');
var auth = document.getElementById('auth');
var member = document.getElementById('member');

var who = name.textContent;
persona.set(who);

button.addEventListener('click', function () {
    if (!persona.id) {
        persona.identify();
    }
    else persona.unidentify();
});
