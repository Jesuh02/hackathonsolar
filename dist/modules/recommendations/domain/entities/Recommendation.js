"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "Recommendation", {
    enumerable: true,
    get: function() {
        return Recommendation;
    }
});
const _Entity = require("../../../../shared/domain/Entity");
function _define_property(obj, key, value) {
    if (key in obj) {
        Object.defineProperty(obj, key, {
            value: value,
            enumerable: true,
            configurable: true,
            writable: true
        });
    } else {
        obj[key] = value;
    }
    return obj;
}
let Recommendation = class Recommendation extends _Entity.Entity {
    static create(props) {
        const id = `rec-${props.businessName}-${props.date}-${Date.now()}`;
        return new Recommendation(id, props);
    }
    get businessName() {
        return this.props.businessName;
    }
    get businessType() {
        return this.props.businessType;
    }
    get date() {
        return this.props.date;
    }
    get recommendations() {
        return this.props.recommendations;
    }
    get energyScore() {
        return this.props.energyScore;
    }
    get estimatedSavings() {
        return this.props.estimatedSavings;
    }
    get generatedAt() {
        return this.props.generatedAt;
    }
    getCriticalRecommendations() {
        return this.props.recommendations.filter((r)=>r.priority === 'critica');
    }
    toJSON() {
        return {
            id: this.id,
            ...this.props
        };
    }
    constructor(id, props){
        super(id), _define_property(this, "props", void 0);
        this.props = props;
    }
};

//# sourceMappingURL=Recommendation.js.map