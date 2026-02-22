exports.up = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.text("icinga2_url").defaultTo(null);
        table.string("icinga2_username").defaultTo(null);
        table.string("icinga2_password").defaultTo(null);
        table.boolean("icinga2_ignore_tls").defaultTo(false);
        table.text("icinga2_host_filter").defaultTo(null);
        table.text("icinga2_service_filter").defaultTo(null);
        table.boolean("icinga2_ignore_warning").defaultTo(false);
        table.boolean("icinga2_ignore_unknown").defaultTo(false);
    });
};

exports.down = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.dropColumn("icinga2_url");
        table.dropColumn("icinga2_username");
        table.dropColumn("icinga2_password");
        table.dropColumn("icinga2_ignore_tls");
        table.dropColumn("icinga2_host_filter");
        table.dropColumn("icinga2_service_filter");
        table.dropColumn("icinga2_ignore_warning");
        table.dropColumn("icinga2_ignore_unknown");
    });
};
