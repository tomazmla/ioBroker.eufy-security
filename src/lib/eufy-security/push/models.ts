export interface EufyPushMessagePayload {
    a: number;                          // Event type, see enum PushEvent
    alarm?: number;                     // ?
    alarm_delay?: number;               // alarm delay...
    alarm_type?: number;
    arming?: number;                    // Station mode (for example 2=SCHEDULE)
    automation_id?: number;
    batt_powered?: number;
    c?: number;                         // Channel (received on event security)
    channel?: number;
    create_time?: number;
    device_name?: string;
    e?: string;                         // Sensor Open (1=True, 0=False)
    event_time?: number;
    event_type?: number;
    f?: string;                         // Person?
    i?: string;                         // (received on event security) FetchId / FaceId?
    j?: string;                         // SenseID
    k?: string;                         // Secret Key (received on event security)
    m?: string;                         // Device status (0=offline, 1=online)
    mode?: number;                      // Station mode (if arming=2=SCHEDULE, this parameter shows the changed mode by SCHEDULE; on manually changing mode, mode=arming)
    n?: string;                         // Nickname / Device name
    name?: string;
    nick_name?: string;
    notification_style?: number;
    p?: string;                         // Filename
    pic_url?: string;
    push_count: number;
    s: string;                          // Station serial number
    session_id?: string;
    short_user_id?: string;
    storage_type?: number;
    t?: string;                         // Timestamp (received on change station mode)
    tfcard?: number;
    type: number;
    unique_id?: string;
    user?: number;                      // User Type (NORMAL=0, ADMIN=1, SUPER_ADMIN=2, ENTRY_ONLY=4)
    user_id?: string;
    user_name?: string;                 // Username
    verify_code?: string;               // 2FA Verification code
}

export interface EufyPushMessage {
    content: string,
    device_sn: string,
    event_time: string,
    payload: EufyPushMessagePayload,
    push_time: string,
    station_sn: string,
    title: string,
    type: string,
    "google.c.sender.id": string
}

export interface PushMessage{
    id: string,
    from: string,
    to: string,
    category: string,
    persistentId: string,
    ttl: number,
    sent: string,
    payload: EufyPushMessage
}

export interface FidTokenResponse {
    token: string;
    expiresIn: string;
    expiresAt: number;
}

export interface FidInstallationResponse {
    name: string;
    fid: string;
    refreshToken: string;
    authToken: FidTokenResponse;
}

export interface CheckinResponse {
    statsOk: boolean;
    timeMs: string;
    androidId: string;
    securityToken: string;
    versionInfo: string;
    deviceDataVersionInfo: string;
}

export interface GcmRegisterResponse {
    token: string;
}

export interface Message {
    tag: number;
    object: any;
}

export enum ProcessingState {
    MCS_VERSION_TAG_AND_SIZE = 0,
    MCS_TAG_AND_SIZE = 1,
    MCS_SIZE = 2,
    MCS_PROTO_BYTES = 3,
}

export enum MessageTag {
    HeartbeatPing = 0,
    HeartbeatAck = 1,
    LoginRequest = 2,
    LoginResponse = 3,
    Close = 4,
    MessageStanza = 5,
    PresenceStanza = 6,
    IqStanza = 7,
    DataMessageStanza = 8,
    BatchPresenceStanza = 9,
    StreamErrorStanza = 10,
    HttpRequest = 11,
    HttpResponse = 12,
    BindAccountRequest = 13,
    BindAccountResponse = 14,
    TalkMetadata = 15,
    NumProtoTypes = 16,
}

export interface Credentials {
    fidResponse: FidInstallationResponse;
    checkinResponse: CheckinResponse;
    gcmResponse: GcmRegisterResponse;
}