"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Station = void 0;
const types_1 = require("./types");
const parameter_1 = require("./parameter");
const protocol_1 = require("../p2p/protocol");
const session_1 = require("../p2p/session");
const types_2 = require("../p2p/types");
const utils_1 = require("../p2p/utils");
const events_1 = require("events");
class Station extends events_1.EventEmitter {
    constructor(api, hub) {
        super();
        this.dsk_key = "";
        this.dsk_expiration = null;
        this.p2p_session = null;
        this.parameters = {};
        this.currentDelay = 0;
        this.api = api;
        this.hub = hub;
        this.log = api.getLog();
        this.loadParameters();
    }
    getStateID(state, level = 2) {
        switch (level) {
            case 0:
                return `${this.getSerial()}`;
            case 1:
                return `${this.getSerial()}.${this.getStateChannel()}`;
            default:
                if (state)
                    return `${this.getSerial()}.${this.getStateChannel()}.${state}`;
                throw new Error("No state value passed.");
        }
    }
    getStateChannel() {
        return "station";
    }
    update(hub) {
        this.hub = hub;
        this.hub.params.forEach(param => {
            if (this.parameters[param.param_type] != param.param_value) {
                this.parameters[param.param_type] = parameter_1.Parameter.readValue(param.param_type, param.param_value);
                this.emit("parameter", this, param.param_type, param.param_value);
            }
        });
    }
    isStation() {
        return this.hub.device_type == types_1.DeviceType.STATION;
    }
    isDeviceStation() {
        return this.hub.device_type != types_1.DeviceType.STATION;
    }
    getDeviceType() {
        return this.hub.device_type;
    }
    getHardwareVersion() {
        return this.hub.main_hw_version;
    }
    getMACAddress() {
        return this.hub.wifi_mac;
    }
    getModel() {
        return this.hub.station_model;
    }
    getName() {
        return this.hub.station_name;
    }
    getSerial() {
        return this.hub.station_sn;
    }
    getSoftwareVersion() {
        return this.hub.main_sw_version;
    }
    getIPAddress() {
        return this.hub.ip_addr;
    }
    loadParameters() {
        this.hub.params.forEach(param => {
            this.parameters[param.param_type] = parameter_1.Parameter.readValue(param.param_type, param.param_value);
        });
        this.log.debug(`Station.loadParameters(): station_sn: ${this.getSerial()} parameters: ${JSON.stringify(this.parameters)}`);
    }
    getParameter(param_type) {
        return this.parameters[param_type];
    }
    getDSKKeys() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const response = yield this.api.request("post", "app/equipment/get_dsk_keys", {
                    station_sns: [this.getSerial()]
                }).catch(error => {
                    this.log.error(`Station.getDSKKeys(): error: ${JSON.stringify(error)}`);
                    return error;
                });
                this.log.debug(`Station.getDSKKeys(): station: ${this.getSerial()} Response: ${JSON.stringify(response.data)}`);
                if (response.status == 200) {
                    const result = response.data;
                    if (result.code == 0) {
                        const dataresult = result.data;
                        dataresult.dsk_keys.forEach(key => {
                            if (key.station_sn == this.getSerial()) {
                                this.dsk_key = key.dsk_key;
                                this.dsk_expiration = new Date(key.expiration * 1000);
                                this.log.debug(`Station.getDSKKeys(): dsk_key: ${this.dsk_key} dsk_expiration: ${this.dsk_expiration}`);
                            }
                        });
                    }
                    else
                        this.log.error(`Station.getDSKKeys(): station: ${this.getSerial()} Response code not ok (code: ${result.code} msg: ${result.msg})`);
                }
                else {
                    this.log.error(`Station.getDSKKeys(): station: ${this.getSerial()} Status return code not 200 (status: ${response.status} text: ${response.statusText}`);
                }
            }
            catch (error) {
                this.log.error(`Station.getDSKKeys(): station: ${this.getSerial()} error: ${error}`);
            }
        });
    }
    isConnected() {
        if (this.p2p_session)
            return this.p2p_session.isConnected();
        return false;
    }
    close() {
        this.log.info(`Disconnect from station ${this.getSerial()}.`);
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = undefined;
        }
        if (this.p2p_session) {
            this.p2p_session.close();
            this.p2p_session = null;
        }
    }
    connect() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.dsk_key == "" || (this.dsk_expiration && (new Date()).getTime() >= this.dsk_expiration.getTime())) {
                this.log.debug(`Station.connect(): station: ${this.getSerial()} DSK keys not present or expired, get/renew it. (dsk_expiration: ${this.dsk_expiration})`);
                yield this.getDSKKeys();
            }
            const proto = new protocol_1.DiscoveryP2PClientProtocol(this.log);
            proto.setDSKKey(this.dsk_key);
            proto.setP2PDid(this.hub.p2p_did);
            const addrs = yield proto.lookup().catch(error => {
                this.log.error(`Station.connect(): error: ${JSON.stringify(error)}`);
                return [];
            });
            this.log.debug("Station.connect(): Discovered station addresses: " + addrs.length);
            if (addrs.length > 0) {
                let local_addr = null;
                for (const addr of addrs) {
                    this.log.debug("Station.connect(): Discovered station addresses: host: " + addr.host + " port: " + addr.port);
                    if (utils_1.isPrivateIp(addr.host)) {
                        local_addr = addr;
                    }
                }
                if (local_addr) {
                    this.p2p_session = new session_1.EufyP2PClientProtocol(local_addr, this.hub.p2p_did, this.hub.member.action_user_id, this.log);
                    this.p2p_session.on("connected", () => this.onConnected());
                    this.p2p_session.on("disconnected", () => this.onDisconnected());
                    this.p2p_session.on("command", (cmd_result) => this.onCommandResponse(cmd_result));
                    this.p2p_session.on("alarm_mode", (mode) => this.onAlarmMode(mode));
                    this.p2p_session.on("camera_info", (camera_info) => this.onCameraInfo(camera_info));
                    this.log.info(`Connect to station ${this.getSerial()} on host ${local_addr.host} and port ${local_addr.port}.`);
                    return yield this.p2p_session.connect().catch(error => {
                        this.log.error(`Station.connect(): P2P session error: ${JSON.stringify(error)}`);
                        return false;
                    });
                }
                else {
                    this.log.error(`No local address discovered for station ${this.getSerial()}.`);
                }
            }
            else {
                this.log.error(`Discovering of connect details for station ${this.getSerial()} failed. Impossible to establish connection!`);
            }
            return false;
        });
    }
    setGuardMode(mode) {
        return __awaiter(this, void 0, void 0, function* () {
            this.log.silly("Station.setGuardMode(): ");
            if (!this.p2p_session || !this.p2p_session.isConnected()) {
                this.log.debug(`Station.setGuardMode(): P2P connection to station ${this.getSerial()} not present, establish it.`);
                yield this.connect();
            }
            if (this.p2p_session) {
                if (this.p2p_session.isConnected()) {
                    this.log.debug(`Station.setGuardMode(): P2P connection to station ${this.getSerial()} present, send command mode: ${mode}.`);
                    yield this.p2p_session.sendCommandWithInt(types_2.CommandType.CMD_SET_ARMING, mode, Station.CHANNEL);
                    // New method available only after a min. software version and only for some devices; The software version is received by FirebaseRemoteConfig
                    // if ((b != null && a.a().a("new_instance_vision_as", b.main_sw_version) && !b.isIntegratedDeviceBySn()) || (b != null && b.isSoloCams())) {
                    // If this is met the following works already:
                    /*await this.p2p_session.sendCommandWithString(CommandType.CMD_SET_PAYLOAD, JSON.stringify({
                        "account_id": this.hub.member.action_user_id,
                        "cmd": CommandType.CMD_SET_ARMING,
                        "mValue3": 0,
                        "payload": {
                            "mode_type": mode,
                            "user_name": this.hub.member.nick_name
                        }
                    }));*/
                }
            }
        });
    }
    getCameraInfo() {
        return __awaiter(this, void 0, void 0, function* () {
            this.log.silly("Station.getCameraInfo(): ");
            if (!this.p2p_session || !this.p2p_session.isConnected()) {
                this.log.debug(`Station.getCameraInfo(): P2P connection to station ${this.getSerial()} not present, establish it.`);
                yield this.connect();
            }
            if (this.p2p_session) {
                if (this.p2p_session.isConnected()) {
                    this.log.debug(`Station.getCameraInfo(): P2P connection to station ${this.getSerial()} present, get camera info.`);
                    yield this.p2p_session.sendCommandWithInt(types_2.CommandType.CMD_CAMERA_INFO, Station.CHANNEL);
                }
            }
        });
    }
    getStorageInfo() {
        return __awaiter(this, void 0, void 0, function* () {
            this.log.silly("Station.getStorageInfo(): ");
            if (!this.p2p_session || !this.p2p_session.isConnected()) {
                this.log.debug(`Station.getStorageInfo(): P2P connection to station ${this.getSerial()} not present, establish it.`);
                yield this.connect();
            }
            if (this.p2p_session) {
                if (this.p2p_session.isConnected()) {
                    this.log.debug(`Station.getStorageInfo(): P2P connection to station ${this.getSerial()} present, get camera info.`);
                    //TODO: Verify channel! Should be 255...
                    yield this.p2p_session.sendCommandWithIntString(types_2.CommandType.CMD_SDINFO_EX, 0);
                }
            }
        });
    }
    onAlarmMode(mode) {
        this.log.info(`Alarm mode for station ${this.getSerial()} changed to: ${types_1.AlarmMode[mode]}`);
        this.parameters[types_1.ParamType.SCHEDULE_MODE] = mode.toString();
        this.emit("parameter", this, types_1.ParamType.SCHEDULE_MODE, mode.toString());
    }
    onCameraInfo(camera_info) {
        //TODO: Finish implementation
        this.log.debug(`Station.onCameraInfo(): station: ${this.getSerial()} camera_info: ${JSON.stringify(camera_info)}`);
    }
    onCommandResponse(cmd_result) {
        this.log.debug(`Station.onCommandResponse(): station: ${this.getSerial()} command_type: ${cmd_result.command_type} channel: ${cmd_result.channel} return_code: ${types_2.ErrorCode[cmd_result.return_code]} (${cmd_result.return_code})`);
        this.emit("p2p_command", this, cmd_result);
    }
    onConnected() {
        this.log.debug(`Station.onConnected(): station: ${this.getSerial()}`);
        //TODO: Finish implementation
    }
    onDisconnected() {
        this.log.debug(`Station.onDisconnected(): station: ${this.getSerial()}`);
        if (this.p2p_session)
            this.scheduleReconnect();
    }
    getParameters() {
        return this.parameters;
    }
    getCurrentDelay() {
        const delay = this.currentDelay == 0 ? 5000 : this.currentDelay;
        if (this.currentDelay < 60000)
            this.currentDelay += 10000;
        if (this.currentDelay >= 60000 && this.currentDelay < 600000)
            this.currentDelay += 60000;
        return delay;
    }
    resetCurrentDelay() {
        this.currentDelay = 0;
    }
    scheduleReconnect() {
        const delay = this.getCurrentDelay();
        this.log.debug(`Station.scheduleReconnect(): delay: ${delay}`);
        if (!this.reconnectTimeout)
            this.reconnectTimeout = setTimeout(() => __awaiter(this, void 0, void 0, function* () {
                if (!(yield this.connect())) {
                    this.reconnectTimeout = undefined;
                    this.scheduleReconnect();
                }
            }), delay);
    }
}
exports.Station = Station;
Station.CHANNEL = 255;
