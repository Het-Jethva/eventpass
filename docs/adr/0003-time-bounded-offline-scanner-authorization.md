# Use time-bounded offline Scanner Authorization

Preloading an Event issues a signed Scanner Authorization scoped to one Event, volunteer, and device through the Event's check-in window. This lets admission continue after the volunteer's ordinary web session expires without granting offline management access; online role revocation takes effect immediately, but an already-isolated scanner remains authorized until its capability expires because revocation cannot propagate without communication.
