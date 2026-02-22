const { MonitorType } = require("./monitor-type");
const { log, UP } = require("../../src/util");
const { axiosAbortSignal } = require("../util-server");
const axios = require("axios");
const https = require("https");

/**
 * Icinga is a monitoring system which checks the availability of your network resources,
 * notifies users of outages, and generates performance data for reporting.
 *
 * https://github.com/Icinga/icinga2
 *
 * API documentation: https://icinga.com/docs/icinga-2/latest/doc/12-icinga2-api
 */

class Icinga2MonitorType extends MonitorType {
    name = "icinga2";

    /**
     * @inheritdoc
     */
    async check(monitor, heartbeat, server) {
        const baseUrl = `https://${monitor.icinga2Url.trim()}`;
        const hostFilter = (monitor.icinga2HostFilter || "").trim();
        const serviceFilter = (monitor.icinga2ServiceFilter || "").trim();

        if (!hostFilter && !serviceFilter) {
            throw new Error("At least one of Host Filter or Service Filter must be set");
        }

        const axiosConfig = this.buildAxiosConfig(monitor, baseUrl);
        let hostsUp = 0;
        let hostsTotal = 0;
        let servicesOk = 0;
        let servicesTotal = 0;

        if (hostFilter) {
            const hosts = await this.queryObjects(axiosConfig, "hosts", hostFilter, [ "name", "state" ]);
            if (hosts.length === 0) {
                throw new Error("Host filter returned no results — check your filter expression");
            }
            hostsTotal = hosts.length;
            for (const host of hosts) {
                if (host.attrs.state === 0) {
                    hostsUp++;
                }
            }
        }

        if (serviceFilter) {
            const services = await this.queryObjects(axiosConfig, "services", serviceFilter, [ "name", "state" ]);
            if (services.length === 0) {
                throw new Error("Service filter returned no results — check your filter expression");
            }
            servicesTotal = services.length;
            const ignoreWarning = Boolean(monitor.icinga2IgnoreWarning);
            const ignoreUnknown = Boolean(monitor.icinga2IgnoreUnknown);

            for (const svc of services) {
                const state = svc.attrs.state;
                if (state === 0 || (state === 1 && ignoreWarning) || (state === 3 && ignoreUnknown)) {
                    servicesOk++;
                }
            }
        }

        const summaryParts = [];
        if (hostFilter) {
            summaryParts.push(`${hostsUp}/${hostsTotal} hosts UP`);
        }
        if (serviceFilter) {
            summaryParts.push(`${servicesOk}/${servicesTotal} services OK`);
        }
        const summary = summaryParts.join(", ");

        if (hostsUp < hostsTotal || servicesOk < servicesTotal) {
            throw new Error(summary);
        }

        heartbeat.status = UP;
        heartbeat.msg = summary;
    }

    /**
     * Build base axios config for Icinga2 API requests
     * @param {object} monitor Monitor configuration
     * @param {string} baseUrl Base URL of Icinga2
     * @returns {object} Axios request config
     */
    buildAxiosConfig(monitor, baseUrl) {
        const config = {
            baseURL: baseUrl,
            timeout: monitor.timeout * 1000,
            headers: {
                "Accept": "application/json",
                "X-HTTP-Method-Override": "GET",
            },
            auth: {
                username: monitor.icinga2Username || "",
                password: monitor.icinga2Password || "",
            },
            signal: axiosAbortSignal((monitor.timeout + 10) * 1000),
        };

        if (Boolean(monitor.icinga2IgnoreTls)) {
            config.httpsAgent = new https.Agent({ rejectUnauthorized: false });
        }

        return config;
    }

    /**
     * Query Icinga2 objects endpoint with a filter expression
     * @param {object} axiosConfig Axios request config
     * @param {string} objectType Object type (hosts, services)
     * @param {string} filter Icinga2 filter expression
     * @param {string[]} attrs Attributes to request
     * @returns {Promise<object[]>} Array of result objects
     */
    async queryObjects(axiosConfig, objectType, filter, attrs) {
        const url = `/v1/objects/${objectType}`;
        const data = { filter, attrs };

        log.debug("monitor", `POST ${axiosConfig.baseURL}${url} filter=${filter}`);

        try {
            const res = await axios.post(url, data, axiosConfig);

            if (!res.data || !Array.isArray(res.data.results)) {
                throw new Error(`Unexpected response from ${objectType} query`);
            }

            return res.data.results;
        } catch (error) {
            if (axios.isCancel(error)) {
                throw new Error("Request timed out");
            }
            if (error.response) {
                const msg = error.response.data?.status || error.response.statusText;
                throw new Error(`Icinga2 API error (${error.response.status}): ${msg}`);
            }
            throw new Error(error.message);
        }
    }

}

module.exports = {
    Icinga2MonitorType,
};
