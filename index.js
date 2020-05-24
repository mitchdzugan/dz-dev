require("@babel/register");
const fuzzy = require('./fuzzy');

const clear = require('clear');
clear();
const core = require('./core.jsx');
core.default();
