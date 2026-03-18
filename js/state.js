/**
 * Application state management
 */
class State {
    constructor() {
        this.regionFilter = 'all';
        this.categoryFilter = 'all';
        this.searchQuery = '';
        this.listeners = [];
    }

    setRegionFilter(value) {
        this.regionFilter = value;
        this.notify();
    }

    setCategoryFilter(value) {
        this.categoryFilter = value;
        this.notify();
    }

    setSearchQuery(value) {
        this.searchQuery = value;
        this.notify();
    }

    getFilters() {
        return {
            region: this.regionFilter,
            category: this.categoryFilter,
            search: this.searchQuery
        };
    }

    subscribe(listener) {
        this.listeners.push(listener);
    }

    notify() {
        this.listeners.forEach(listener => listener());
    }
}

export const state = new State();
