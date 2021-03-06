var Dispatcher = require('flux').Dispatcher;
var EventEmitter = require('events').EventEmitter;
var assign = require('object-assign');
var _storeFactories = {};
var _instances = []
var _id = 0;
var genId = function() {
	var id = _id;
	_id++;
	return id;
}
var Fluxx = function() {
	var _stores = [];
	var _promises = [];
	var F = function() {};
	var id = genId();
	F.prototype = new Dispatcher;
	F.prototype.getStore = function(name) {
		return _stores[name];
	}
		
	var instance = _instances[id] = new F();
	F.prototype.createStore = function(name) {
		return _stores[name] = assign({}, EventEmitter.prototype, _storeFactories[name].apply({flux: instance}));
	}
	F.prototype.getActions = function(name) {
		name = name || 'global';
		var actions = {}
		for(var i in _actions[name]) { 
			actions[i] = (function(action) {
				return function() {
					 _promises.push(action.apply({flux: instance}, arguments));
				};
			})(_actions[name][i]);
			actions[i].valueOf = (function(name, i) {
				return function() {
					return name + '-' + i;
				}
			})(name, i);
			actions[i].dispatch = (function(action) {
				return function() {
					instance.dispatch.call(instance, {
						actionType: action,
						value: arguments
					});
				}
			})(actions[i]);
		}
		return actions;
	}
	F.prototype.ready = function(cb) {
		Promise.all(_promises).then(function(result) {
			_promises = [];
			cb();
		});
	}
	F.prototype.listenTo = function(store, listener) {
		var cbs = {};
		listener(function(action, cb) {
			cbs[action.valueOf()] = cb;
		});
		return instance.register(function(payload) {
			var s = instance.getStore(store);
			s[cbs[payload.actionType.valueOf()]].apply(s, payload.value);
		});
	}
	F.prototype.dehydrate = function() {
		var data = {};
		for(var i in _stores) {
			if(_stores[i].dehydrate) {
				data[i] = _stores[i].dehydrate();
			}
		}
		return data;
	}
	F.prototype.rehydrate = function(data) {
		for(var i in data) {
			_stores[i].rehydrate(data[i]);
		}
	}
	for(var i in _storeFactories) {
		instance.createStore(i);
	}
	return instance;
};

Fluxx.store = function(name, factory) {
	_storeFactories[name] = factory;
	for(var i in _instances) {
		_instances[i].createStore(name);
	}
};

var _actions = {};
Fluxx.action = function(name, actions) {
	if(!actions) {
		actions = name;
		name = 'global';
	}
	if(!_actions[name])
		_actions[name] = {};
	for(var i in actions) { 
		
		_actions[name][i] = actions[i];
	}
};

Fluxx.mixin = function(React) {
	var getContext = function(com) {
		return com.props.flux || (com.context && com.context.flux);
	}
	return {
		contextTypes: {
			flux: React.PropTypes.object
		},
		childContextTypes: {
			flux: React.PropTypes.object
		},
		getChildContext: function() {
			return {
				flux: getContext(this),
			};
		},
		flux: function() {
			return getContext(this);
		}
	}
}
module.exports = Fluxx;
