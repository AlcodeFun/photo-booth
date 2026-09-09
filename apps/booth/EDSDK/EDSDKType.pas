{ ******************************************************************************
  *                                                                             *
  *   PROJECT : EOS Digital Software Development Kit EDSDK                      *
  *      NAME : EDSDKType.pas                                                   *
  *                                                                             *
  *   Description: This is the Sample code to show the usage of EDSDK.          *
  *                                                                             *
  *                                                                             *
  *******************************************************************************
  *                                                                             *
  *   Written and developed by Camera Design Dept.53                            *
  *   Copyright Canon Inc. 2006 All Rights Reserved                             *
  *                                                                             *
  *******************************************************************************
  *   File Update Information:                                                  *
  *     DATE      Identify    Comment                                           *
  *   -----------------------------------------------------------------------   *
  *   06-03-22    F-001        create first version.                            *
  *                                                                             *
  ****************************************************************************** }
unit EDSDKType;

interface

const
  EDS_MAX_NAME = 256;

const
  WM_USER = 1024;
  wm_handlePropertyEvent = WM_USER + 1;
  wm_handleStateEvent = WM_USER + 2;
  wm_handleCameraAddedEvent = WM_USER + 3;

type
  { --------------- BASIC TYPE ------------ }
  EdsBool = Integer;

  EdsChar = AnsiChar;
  EdsInt8 = Shortint;
  EdsUInt8 = Byte;
  EdsInt16 = Smallint;
  EdsUInt16 = Word;
  EdsInt32 = Integer;
  EdsUInt32 = Cardinal;
  EdsInt64 = Int64;
  EdsUInt64 = Int64;
  EdsFloat = single;
  EdsDouble = double;

  { ------------- ERROR TYPES ----------- }
  EdsError = EdsUInt32;

  { -----------------------------------------------------------------------------
    EdsBaseRef
    A EdsBaseRef is a reference to an object.
    ------------------------------------------------------------------------------ }
  EdsObject = Pointer;
  EdsBaseRef = EdsObject; // Baseic refernce

  EdsCameraListRef = EdsBaseRef; // Reference to a camera list
  PEdsCameraListRef = ^EdsCameraListRef;

  EdsCameraRef = EdsBaseRef; // Reference to a camera

  { -----------------------------------------------------------------------------
    Data Type
    ----------------------------------------------------------------------------- }
type
  EdsDataType = EdsUInt32;

type
  EdsEnumDataType = ( { * enumeration * }
    kEdsDataType_Unknown = 0, kEdsDataType_Bool = 1, kEdsDataType_String = 2,
    kEdsDataType_Int8 = 3, kEdsDataType_Int16 = 4, kEdsDataType_UInt8 = 6,
    kEdsDataType_UInt16 = 7, kEdsDataType_Int32 = 8, kEdsDataType_UInt32 = 9,
    kEdsDataType_Int64 = 10, kEdsDataType_UInt64 = 11, kEdsDataType_Float = 12,
    kEdsDataType_Double = 13, kEdsDataType_ByteBlock = 14,

    kEdsDataType_Rational = 20, kEdsDataType_Point = 21, kEdsDataType_Rect = 22,
    kEdsDataType_Time = 23,

    kEdsDataType_Bool_Array = 30, kEdsDataType_Int8_Array = 31,
    kEdsDataType_Int16_Array = 32, kEdsDataType_Int32_Array = 33,
    kEdsDataType_UInt8_Array = 34, kEdsDataType_UInt16_Array = 35,
    kEdsDataType_UInt32_Array = 36, kEdsDataType_Rational_Array = 37,

    kEdsDataType_FocusInfo = 101, kEdsDataType_PictureStyleDesc

    );

  { -----------------------------------------------------------------------------
    Property ID Definition
    ----------------------------------------------------------------------------- }
type
  EdsPropertyID = EdsUInt32;

const
  kEdsPropID_Unknown = $0000FFFF;

  { Camera Setting Property }
  kEdsPropID_ProductName = $00000002; { Product name }
  kEdsPropID_OwnerName = $00000004; { owner name }
  kEdsPropID_MakerName = $00000005; { maker name }
  kEdsPropID_DateTime = $00000006; { system time (Camera) }
  kEdsPropID_FirmwareVersion = $00000007; { Firmware Version }
  kEdsPropID_BatteryLevel = $00000008; { Battery status 0- 100% or 'AC' }
  kEdsPropID_BatteryQuality = $00000010;
  kEdsPropID_BodyIDEx = $00000015; // Serial Number
  kEdsPropID_ShutterCounter = $00000022;

  kEdsPropID_LensName = $0000040D;
  kEdsPropID_LensStatus = $00000416;
  kEdsPropID_Artist = $00000418; //
  kEdsPropID_Copyright = $00000419; //

  { -----------------------------------------------------------------------------
    Time
    ----------------------------------------------------------------------------- }
type
  EdsTime = record
    year: EdsUInt32; // year
    month: EdsUInt32; // month 1=January, 2=February, ...
    day: EdsUInt32; // day
    hour: EdsUInt32; // hour
    minute: EdsUInt32; // minute
    second: EdsUInt32; // second
    milliseconds: EdsUInt32; // reserved
  end;

  PEdsTime = ^EdsTime;

  { -----------------------------------------------------------------------------
    Camera Commands --- Send command and State command
    ------------------------------------------------------------------------------ }
type
  EdsCameraCommand = EdsUInt32;
  EdsCameraStateCommand = EdsUInt32;

  { -------------------------
    Send Commands
    ------------------------ }
const
  kEdsCameraCommand_ExtendShutDownTimer = $00000001;

  { -------------------------
    Camera State Command
    ------------------------ }
const
  kEdsCameraState_UILock = $00000000; { Locks the UI }
  kEdsCameraState_UIUnLock = $00000001; { Unlocks the UI }

  { -----------------------------------------------------------------------------
    Camera Events
    ----------------------------------------------------------------------------- }
type
  EdsPropertyEvent = EdsUInt32;

const
  { Notifies all property events. }
  kEdsPropertyEvent_All = $00000100;

  { Notifies that a camera property value has been changed.
    The changed property can be retrieved from event data.
    The changed value can be retrieved by means of EdsGetPropertyData.
    In the case of type 1 protocol standard cameras,
    notification of changed properties can only be issued for custom functions (CFn).
    If the property type is 0x0000FFFF, the changed property cannot be identified.
    Thus, retrieve all required properties repeatedly. }
  kEdsPropertyEvent_PropertyChanged = $00000101;

  { Notifies of changes in the list of camera properties with configurable values.
    The list of configurable values for property IDs indicated in event data
    can be retrieved by means of EdsGetPropertyDesc.
    For type 1 protocol standard cameras, the property ID is identified as "Unknown"
    during notification.
    Thus, you must retrieve a list of configurable values for all properties and
    retrieve the property values repeatedly.
    ( For details on properties for which you can retrieve a list of configurable
    properties, see the description of EdsGetPropertyDesc ). }
  kEdsPropertyEvent_PropertyDescChanged = $00000102;

  { -----------------------------------------------------------------------------
    State Events
    ----------------------------------------------------------------------------- }
type
  EdsStateEvent = EdsUInt32;

const
  { Notifies all state events. }
  kEdsStateEvent_ALL = $00000300;

  { Indicates that a camera is no longer connected to a computer,
    whether it was disconnected by unplugging a cord, opening
    the compact flash compartment,
    turning the camera off, auto shut-off, or by other means. }
  kEdsStateEvent_ShutDown = $00000301;

  { Notifies of whether or not there are objects waiting to be transferred to
    a host computer.  This is useful when ensuring all shot images have been
    transferred when the application is closed.
    Notification of this event is not issued for type 1 protocol standard cameras. }
  kEdsStateEvent_JobStatusChanged = $00000302;

  { Notifies that the camera will shut down after a specific period.
    Generated only if auto shut-off is set.
    Exactly when notification is issued (that is, the number of
    seconds until shutdown) varies depending on the camera model.
    To continue operation without having the camera shut down,
    use EdsSendCommand to extend the auto shut-off timer.
    The time in seconds until the camera shuts down is returned
    as the initial value. }
  kEdsStateEvent_WillSoonShutDown = $00000303;

  { As the counterpart event to kEdsStateEvent_WillSoonShutDown,
    this event notifies of updates to the number of seconds until
    a camera shuts down.
    After the update, the period until shutdown is model-dependent. }
  kEdsCameraEvent_ShutDownTimerUpdate = $00000304;

  { Notifies that a requested release has failed, due to focus
    failure or similar factors. }
  kEdsCameraEvent_CaptureError = $00000305;

  { Notifies of internal SDK errors.
    If this error event is received, the issuing device will probably
    not be able to continue working properly, so cancel the remote connection. }
  kEdsCameraEvent_InternalError = $00000306;

  kEdsStateEvent_AfResult = $00000309;

  kEdsStateEvent_BulbExposureTime = $00000310;

  { -----------------------------------------------------------------------------
    Battery level
    ----------------------------------------------------------------------------- }
type
  EdsBatteryLevel = EdsUInt32;

const
  kEdsBatteryLevel_Empty = 1;
  kEdsBatteryLevel_Low = 30;
  kEdsBatteryLevel_Half = 50;
  kEdsBatteryLevel_Normal = 80;
  kEdsBatteryLevel_AC = $FFFFFFFF;

  { -----------------------------------------------------------------------------
    Battery level - 212
    ----------------------------------------------------------------------------- }
type
  EdsBatteryLevel2 = EdsUInt32;

const
  kEdsBatteryLevel2_Empty = 0;
  kEdsBatteryLevel2_Low = 9;
  kEdsBatteryLevel2_Half = 49;
  kEdsBatteryLevel2_Normal = 80;
  kEdsBatteryLevel2_Hi = 69;
  kEdsBatteryLevel2_Quarter = 19;
  kEdsBatteryLevel2_Error = 0;
  kEdsBatteryLevel2_BCLevel = 0;
  kEdsBatteryLevel2_AC = $FFFFFFFF;

  { ******************************************************************************
    Definition of Structures ( Record )
    ****************************************************************************** }

  { -----------------------------------------------------------------------------
    Device Info
    szPortName : port name
    DeviceDescription : device name ex. 'EOS 20D PTP'
    deviceSubType : Canon legacy protocal camera = 0, Canon PTP cameras = 1
    ----------------------------------------------------------------------------- }
type
  EdsDeviceInfo = record
    szPortName: array [0 .. EDS_MAX_NAME - 1] of EdsChar;
    szDeviceDescription: array [0 .. EDS_MAX_NAME - 1] of EdsChar;
    deviceSubType: EdsUInt32;
    reserved: EdsUInt32; // 27
  end;

  PEdsDeviceInfo = ^EdsDeviceInfo;

  { ******************************************************************************
    Camera Detect Evnet Handler
    ****************************************************************************** }
type
  EdsCameraAddedHandler = function(inContext: Pointer): EdsError; stdcall;

implementation

end.
