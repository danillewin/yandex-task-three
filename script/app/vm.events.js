(function (app) {

    app.vm.Events = function() {
        var self = this;

        self.eventsContainer = new base2.Map();

        self.NAMES = {
            TRACK_SWITCH: "track-switch",
        };

        self.REGISTRARS = {
            TrackList: "track-list",
            Player: "player"
        };
    };

    app.vm.Events.prototype.registerEventCallback = function(eventType, registeredBy, callFunc) {
        var eventCalls = this.getEventCalls(eventType);

        if (eventCalls.get(registeredBy) === undefined) {
            eventCalls.put(registeredBy, callFunc);
        }
    };

    app.vm.Events.prototype.removeEventCallback = function(eventType, registeredBy) {
        var calls = this.getEventCalls(eventType);

        calls.remove(registeredBy);
    };

    app.vm.Events.prototype.getEventCalls = function(eventType) {
        if (!this.eventsContainer.get(eventType)) {
            this.eventsContainer.put(eventType, new base2.Map());
        }

        return this.eventsContainer.get(eventType);
    };

    app.vm.Events.prototype.fireEvent = function (eventType, eventData) {
        var eventCallbacks = this.eventsContainer.get(eventType);

        if (eventCallbacks) {
            this.makeCalls(eventCallbacks, eventData);
        }
    };

    app.vm.Events.prototype.makeCalls = function(calls, eventData) {
        calls.forEach(function(callFunc, registrar) {
            if (typeof(callFunc) == "function") {
                callFunc(eventData);
            }
        });
    };

})(window.app)
