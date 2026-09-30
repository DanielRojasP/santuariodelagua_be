import type { Schema, Struct } from '@strapi/strapi';

export interface SchedulesGuidedSchedules extends Struct.ComponentSchema {
  collectionName: 'components_schedules_guided_schedules';
  info: {
    displayName: 'Guided Schedules';
  };
  attributes: {
    is_available: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<true>;
    max_capacity: Schema.Attribute.Integer & Schema.Attribute.Required;
    time: Schema.Attribute.Time & Schema.Attribute.Required;
  };
}

export interface SchedulesSchedules extends Struct.ComponentSchema {
  collectionName: 'components_schedules_schedules';
  info: {
    displayName: 'Schedules';
  };
  attributes: {
    is_available: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<true>;
    max_capacity: Schema.Attribute.Integer & Schema.Attribute.Required;
    time: Schema.Attribute.Time & Schema.Attribute.Required;
  };
}

declare module '@strapi/strapi' {
  export namespace Public {
    export interface ComponentSchemas {
      'schedules.guided-schedules': SchedulesGuidedSchedules;
      'schedules.schedules': SchedulesSchedules;
    }
  }
}
