unit CanonCamera;

interface

uses
  Windows, Sysutils, Classes, messages,
  EDSDKApi, EDSDKType, EDSDKError;

type
  TCanonCamera = class(TComponent)
  private
    FhWnd: HWND;
    FIsSDKLoaded: Boolean;
    FIsCameraSelected: Boolean;
    FIsConnected: Boolean;
    FEdsCameraRef: EdsCameraRef;
    FIsLegacy: Boolean;
    FIsLocked: Boolean;
    FDateTime: TDateTime;
    { Camera properties }
    FDeviceInfo: EdsDeviceInfo;
    procedure TerminateSDK;

  public
    LastError: EdsError;
    constructor Create(HWND: HWND);
    destructor Destroy; override;

    { init Callback Handlers }
    function SetEventCallBack(): Boolean;

    { init camera }
    function LoadSDK(): Boolean;
    function SelectCamera(): Boolean;
    function Connect(): Boolean;
    procedure DisConnect();
    function GetDeviceInfoName(): AnsiString;
    { get camera properties }
    function GetProductName(var PrtyStr: AnsiString): Boolean;
    function GetFirmwareVersion(var PrtyStr: AnsiString): Boolean;
    function GetShutterCounter: integer;
    function GetArtist(var PrtyStr: AnsiString): Boolean;
    function GetCopyright(var PrtyStr: AnsiString): Boolean;
    function GetSerial(var PrtyStr: AnsiString): Boolean;
    function GetOwnerName(var PrtyStr: AnsiString): Boolean;
    function GetLensName(var PrtyStr: AnsiString): Boolean;

    function GetBatteryLevel(var Prty: EdsUInt32): Boolean;
    function GetBatteryQuality(var Prty: EdsUInt32): Boolean;
    { send camera commands }
    function ExtendShutdown(): Boolean;
    function ReadPropertyString(PropertyID: EdsPropertyID): AnsiString;
    function WritePropertyString(PropertyID: EdsPropertyID;
      s: PAnsiChar): Boolean;

    // function ReadPropertyEdsUInt32(PropertyID: EdsPropertyID): EdsUInt32;
    // function WritePropertyEdsUInt32(PropertyID: EdsPropertyID;
    // PropertyValue: EdsUInt32): Boolean;

    function SynchroPropertyDateTime(): Boolean;
    function ReadPropertyDateTime(): TDateTime;

    // properties
    // property isSDKLoaded: Boolean read FIsSDKLoaded;
    property IsCameraSelected: Boolean read FIsCameraSelected;
    property IsConnected: Boolean read FIsConnected;
    property SystemDateTime: TDateTime read FDateTime write FDateTime;
  end;

Function ErrToStr(ErrNum: EdsError): String;
Function PropertyIdToStr(PropID: EdsUInt32): AnsiString;
Function StateEventIdToStr(StateEventID: EdsUInt32): AnsiString;

implementation

constructor TCanonCamera.Create(HWND: HWND);
begin
  Self.FhWnd := HWND;
  Self.FIsSDKLoaded := False;
  Self.FIsCameraSelected := False;
  Self.FIsConnected := False;
  Self.LastError := EDS_ERR_OK;
  Self.FEdsCameraRef := nil;
end;

destructor TCanonCamera.Destroy;
begin
  { disconnect camera }
  if FIsConnected then
    EdsCloseSession(FEdsCameraRef);
  if (FEdsCameraRef <> nil) then
    EdsRelease(FEdsCameraRef);
  TerminateSDK;
  inherited;
end;

function TCanonCamera.GetDeviceInfoName(): AnsiString;
begin
  EdsGetDeviceInfo(FEdsCameraRef, FDeviceInfo);
  result := AnsiString(FDeviceInfo.szDeviceDescription);
end;

procedure TCanonCamera.DisConnect;
begin
  if FIsSDKLoaded then
  begin
    { disconnect camera }
    if FIsConnected then
      Self.LastError := EdsCloseSession(FEdsCameraRef);
  end;
  Self.FIsCameraSelected := False;
  Self.FIsConnected := False;
  Self.LastError := EDS_ERR_OK;
end;

procedure TCanonCamera.TerminateSDK;
begin
  if FIsSDKLoaded then
  begin
    { disconnect camera }
    if FIsConnected then
      Self.LastError := EdsCloseSession(FEdsCameraRef);

    if (FEdsCameraRef <> nil) then
      Self.LastError := EdsRelease(FEdsCameraRef);
    Self.LastError := EdsTerminateSDK;
  end;
  Self.FIsCameraSelected := False;
  Self.FIsConnected := False;
  Self.LastError := EDS_ERR_OK;
  FIsSDKLoaded := False;
end;

function TCanonCamera.Connect(): Boolean;
begin
  result := False;
  if not FIsConnected then
  begin
    // The communication with the camera begins
    Self.LastError := EdsOpenSession(Self.FEdsCameraRef);
    FIsConnected := (Self.LastError = EDS_ERR_OK);
  end;
  result := FIsConnected;
end;

// Initialization of SDK
function TCanonCamera.LoadSDK(): Boolean;
begin
  result := False;
  if not FIsSDKLoaded then
  begin
    Self.LastError := EdsInitializeSDK;
    FIsSDKLoaded := (Self.LastError = EDS_ERR_OK);
  end;
  result := FIsSDKLoaded;
end;

function TCanonCamera.SelectCamera(): Boolean;
var
  cameraList: EdsCameraListRef;
  count: EdsUInt32;
begin
  result := False;
  cameraList := nil;
  count := 0;
  if not FIsCameraSelected then
  begin
    // Acquisition of camera list
    Self.LastError := EdsGetCameraList(cameraList);
    if Self.LastError <> EDS_ERR_OK then
      Exit;

    // Acquisition of number of Cameras
    Self.LastError := EdsGetChildCount(cameraList, count);
    if Self.LastError <> EDS_ERR_OK then
      Exit;

    if count = 0 then
    begin
      Self.LastError := EDS_ERR_DEVICE_NOT_FOUND;
      Exit;
    end;

    // Acquisition of camera at the head of the list
    Self.LastError := EdsGetChildAtIndex(cameraList, 0, Self.FEdsCameraRef);
    if Self.LastError <> EDS_ERR_OK then
      Exit;

    // Release camera list
    if cameraList <> nil then
      EdsRelease(cameraList);

    if not Assigned(Self.FEdsCameraRef) then
    begin
      Self.LastError := EDS_ERR_DEVICE_NOT_FOUND;
      Exit;
    end;

    FIsCameraSelected := True;
    Self.FIsLegacy := (Self.FDeviceInfo.deviceSubType = 0);
  end;
  result := True;
end;

{ ============================================================================== }
{ E V E N T    H A N D L E R
  {============================================================================== }

{ Propery event handler }
function handlePropertyEvent(inEvent: EdsUInt32; inPropertyID: EdsUInt32;
  inParam: EdsUInt32; inContext: EdsUInt32): EdsError; stdcall;
begin
  PostMessage(HWND(inContext), wm_handlePropertyEvent, integer(inEvent),
    integer(inPropertyID));
  result := EDS_ERR_OK;
end;

{ status Camera event handler }
function handleStateEvent(inEvent: EdsStateEvent; inParamter: EdsUInt32;
  inContext: EdsUInt32): EdsError; stdcall;
begin
  PostMessage(HWND(inContext), wm_handleStateEvent, integer(inEvent),
    integer(inParamter));
  result := EDS_ERR_OK;
end;

{ AddCamera event handler }
function handleCameraAddedEvent(inContext: EdsUInt32): EdsError; stdcall;
begin
  PostMessage(HWND(inContext), wm_handleCameraAddedEvent, 0, 0);
  result := EDS_ERR_OK;
end;

function TCanonCamera.SetEventCallBack(): Boolean;
begin
  result := False;
  { register added camera event handler }
  Self.LastError := EdsSetCameraAddedHandler(@handleCameraAddedEvent, FhWnd);
  result := (Self.LastError = EDS_ERR_OK);
  if Self.LastError <> EDS_ERR_OK then
    Exit;
  if not FIsConnected then
    Exit;
  { register property event handler }
  Self.LastError := EdsSetPropertyEventHandler(Self.FEdsCameraRef,
    kEdsPropertyEvent_All, @handlePropertyEvent, FhWnd);
  result := (Self.LastError = EDS_ERR_OK);
  if Self.LastError <> EDS_ERR_OK then
    Exit;
  { register status event handler }
  Self.LastError := EdsSetCameraStateEventHandler(Self.FEdsCameraRef,
    kEdsStateEvent_All, @handleStateEvent, FhWnd);
  result := (Self.LastError = EDS_ERR_OK);
  if Self.LastError <> EDS_ERR_OK then
    Exit;
end;

function TCanonCamera.GetProductName(var PrtyStr: AnsiString): Boolean;
begin
  PrtyStr := Self.ReadPropertyString(kEdsPropID_ProductName);
  result := (Self.LastError = EDS_ERR_OK);
end;

function TCanonCamera.GetFirmwareVersion(var PrtyStr: AnsiString): Boolean;
begin
  PrtyStr := Self.ReadPropertyString(kEdsPropID_FirmwareVersion);
  result := (Self.LastError = EDS_ERR_OK);
end;

function TCanonCamera.GetBatteryQuality(var Prty: EdsUInt32): Boolean;
var
  dataSize: EdsUInt32;
  dataType: EdsUInt32;
  data: EdsUInt32;
  P: Pointer;
begin
  result := False;
  Self.LastError := EdsGetPropertySize(Self.FEdsCameraRef,
    kEdsPropID_BatteryQuality, 0, dataType, dataSize);
  if Self.LastError <> EDS_ERR_OK then
    Exit;
  P := @data;
  Self.LastError := EdsGetPropertyData(Self.FEdsCameraRef,
    kEdsPropID_BatteryQuality, 0, dataSize, Pointer(P^));
  Prty := data;
  result := (Self.LastError = EDS_ERR_OK);
end;

function TCanonCamera.GetBatteryLevel(var Prty: EdsUInt32): Boolean;
// Result := -1 if AC power
// 0-100% if on battery
var
  dataSize: EdsUInt32;
  dataType: EdsUInt32;
  data: EdsUInt32;
  P: Pointer;
begin
  result := False;
  Self.LastError := EdsGetPropertySize(Self.FEdsCameraRef,
    kEdsPropID_BatteryLevel, 0, dataType, dataSize);
  if Self.LastError <> EDS_ERR_OK then
    Exit;
  P := @data;
  Self.LastError := EdsGetPropertyData(Self.FEdsCameraRef,
    kEdsPropID_BatteryLevel, 0, dataSize, Pointer(P^));
  Prty := data;
  result := (Self.LastError = EDS_ERR_OK);
end;

function TCanonCamera.GetArtist(var PrtyStr: AnsiString): Boolean;
begin
  PrtyStr := Self.ReadPropertyString(kEdsPropID_Artist);
  result := (Self.LastError = EDS_ERR_OK);
end;

function TCanonCamera.GetCopyright(var PrtyStr: AnsiString): Boolean;
begin
  result := False;
  PrtyStr := Self.ReadPropertyString(kEdsPropID_Copyright);
  if Self.LastError <> EDS_ERR_OK then
    Exit
  else
    result := True;
end;

function TCanonCamera.GetSerial(var PrtyStr: AnsiString): Boolean;
var
  serial: Int64;
begin
  result := False;
  PrtyStr := Self.ReadPropertyString(kEdsPropID_BodyIDEx);

  if Self.LastError <> EDS_ERR_OK then
    Exit;
  serial := StrToInt64(PrtyStr);
  if (serial < 0) then
  begin
    serial := $FFFFFFFF and serial;
    PrtyStr := IntToStr(serial);
  end;
  result := True;
end;

function TCanonCamera.GetOwnerName(var PrtyStr: AnsiString): Boolean;
begin
  result := False;
  PrtyStr := Self.ReadPropertyString(kEdsPropID_OwnerName);
  if Self.LastError <> EDS_ERR_OK then
    Exit
  else
    result := True;
end;

function TCanonCamera.GetLensName(var PrtyStr: AnsiString): Boolean;
begin

  result := False;
  PrtyStr := Self.ReadPropertyString(kEdsPropID_LensName);
  if Self.LastError <> EDS_ERR_OK then
    Exit
  else
    result := True;
end;

function TCanonCamera.ExtendShutdown(): Boolean;
begin
  result := False;

  if not FIsConnected then
    Exit;

  { For cameras earlier than the 30D, the camera UI must be
    locked before commands are issued. }
  if not FIsLocked then
  begin
    if FIsLegacy then
    begin
      Self.LastError := EdsSendStatusCommand(Self.FEdsCameraRef,
        kEdsCameraState_UILock, 0);
      if Self.LastError <> EDS_ERR_OK then
        Exit;
      FIsLocked := True;
    end;
  end;

  Self.LastError := EdsSendCommand(Self.FEdsCameraRef,
    kEdsCameraCommand_ExtendShutDownTimer, 0);
  if Self.LastError <> EDS_ERR_OK then
    Exit;

  if FIsLegacy then
  begin
    if FIsLocked then
    begin
      Self.LastError := EdsSendStatusCommand(Self.FEdsCameraRef,
        kEdsCameraState_UIUnLock, 0);
      if Self.LastError <> EDS_ERR_OK then
        Exit;
      FIsLocked := False;
    end;
  end;

  result := (Self.LastError = EDS_ERR_OK);
end;

Function PropertyIdToStr(PropID: EdsUInt32): AnsiString;
begin
  case PropID of
    kEdsPropID_OwnerName:
      result := 'kEdsPropID_OwnerName';
    kEdsPropID_DateTime:
      result := 'kEdsPropID_DateTime';
    kEdsPropID_Artist:
      result := 'kEdsPropID_Artist';
    kEdsPropID_Copyright:
      result := 'kEdsPropID_Copyright';
  else
    result := 'kEdsPropID_Unknown / not kEdsPropID listed';
  end;
end;

Function StateEventIdToStr(StateEventID: EdsUInt32): AnsiString;
begin
  case StateEventID of
    kEdsStateEvent_ShutDown:
      result := 'State Event: Shut Down';
    kEdsStateEvent_WillSoonShutDown:
      result := 'State Event: Will Soon Shut Down';
    kEdsCameraEvent_ShutDownTimerUpdate:
      result := 'State Event: Shut Down Timer Update';
    kEdsCameraEvent_InternalError:
      result := 'Camera Event: Internal Error';
  else
    result := 'kEdsPropID_Unknown / not kEdsPropID listed';
  end;
end;

Function ErrToStr(ErrNum: EdsError): String;
begin
  case ErrNum of
    EDS_ISSPECIFIC_MASK:
      result := 'EDS_ISSPECIFIC_MASK';
    EDS_COMPONENTID_MASK:
      result := 'EDS_COMPONENTID_MASK';
    EDS_RESERVED_MASK:
      result := 'EDS_RESERVED_MASK';
    EDS_ERRORID_MASK:
      result := 'EDS_ERRORID_MASK';
    { ED-SDK Base Component IDs }
    EDS_CMP_ID_CLIENT_COMPONENTID:
      result := 'EDS_CMP_ID_CLIENT_COMPONENTID';
    EDS_CMP_ID_LLSDK_COMPONENTID:
      result := 'EDS_CMP_ID_LLSDK_COMPONENTID';
    EDS_CMP_ID_HLSDK_COMPONENTID:
      result := 'EDS_CMP_ID_HLSDK_COMPONENTID';
    { ED-SDK Functin Success Code }
    EDS_ERR_OK:
      result := 'EDS_ERR_OK';
    { ED-SDK Generic Error IDs }
    // Miscellaneous errors
    EDS_ERR_UNIMPLEMENTED:
      result := 'EDS_ERR_UNIMPLEMENTED { Not implemented }';
    EDS_ERR_INTERNAL_ERROR:
      result := 'EDS_ERR_INTERNAL_ERROR { Internal error  }';
    EDS_ERR_MEM_ALLOC_FAILED:
      result := 'EDS_ERR_MEM_ALLOC_FAILED { Memory allocation error }';
    EDS_ERR_MEM_FREE_FAILED:
      result := 'EDS_ERR_MEM_FREE_FAILED { Memory release error }';
    EDS_ERR_OPERATION_CANCELLED:
      result := 'EDS_ERR_OPERATION_CANCELLED { Operation canceled }';
    EDS_ERR_INCOMPATIBLE_VERSION:
      result := 'EDS_ERR_INCOMPATIBLE_VERSION { Version error }';
    EDS_ERR_NOT_SUPPORTED:
      result := 'EDS_ERR_NOT_SUPPORTED { Not supported }';
    EDS_ERR_UNEXPECTED_EXCEPTION:
      result := 'EDS_ERR_UNEXPECTED_EXCEPTION { Unexpected exception }';
    EDS_ERR_PROTECTION_VIOLATION:
      result := 'EDS_ERR_PROTECTION_VIOLATION { Protection violation }';
    EDS_ERR_MISSING_SUBCOMPONENT:
      result := 'EDS_ERR_MISSING_SUBCOMPONENT { Missing subcomponent }';
    EDS_ERR_SELECTION_UNAVAILABLE:
      result := 'EDS_ERR_SELECTION_UNAVAILABLE { Selection unavailable }';
    // File errors
    EDS_ERR_FILE_IO_ERROR:
      result := 'EDS_ERR_FILE_IO_ERROR { I/O error }';
    EDS_ERR_FILE_TOO_MANY_OPEN:
      result := 'EDS_ERR_FILE_TOO_MANY_OPEN { Too many files open }';
    EDS_ERR_FILE_NOT_FOUND:
      result := 'EDS_ERR_FILE_NOT_FOUND { File does not exist }';
    EDS_ERR_FILE_OPEN_ERROR:
      result := 'EDS_ERR_FILE_OPEN_ERROR { Open error }';
    EDS_ERR_FILE_CLOSE_ERROR:
      result := 'EDS_ERR_FILE_CLOSE_ERROR { Close error }';
    EDS_ERR_FILE_SEEK_ERROR:
      result := 'EDS_ERR_FILE_SEEK_ERROR { Seek error }';
    EDS_ERR_FILE_TELL_ERROR:
      result := 'EDS_ERR_FILE_TELL_ERROR { Tell error }';
    EDS_ERR_FILE_READ_ERROR:
      result := 'EDS_ERR_FILE_READ_ERROR { Read error }';
    EDS_ERR_FILE_WRITE_ERROR:
      result := 'EDS_ERR_FILE_WRITE_ERROR { Write error }';
    EDS_ERR_FILE_PERMISSION_ERROR:
      result := 'EDS_ERR_FILE_PERMISSION_ERROR { Permission error }';
    EDS_ERR_FILE_DISK_FULL_ERROR:
      result := 'EDS_ERR_FILE_DISK_FULL_ERROR { Disk full }';
    EDS_ERR_FILE_ALREADY_EXISTS:
      result := 'EDS_ERR_FILE_ALREADY_EXISTS { File already exists }';
    EDS_ERR_FILE_FORMAT_UNRECOGNIZED:
      result := 'EDS_ERR_FILE_FORMAT_UNRECOGNIZED { Format error }';
    EDS_ERR_FILE_DATA_CORRUPT:
      result := 'EDS_ERR_FILE_DATA_CORRUPT { Invalid data }';
    EDS_ERR_FILE_NAMING_NA:
      result := 'EDS_ERR_FILE_NAMING_NA { File naming error }';
    // Directory errors
    EDS_ERR_DIR_NOT_FOUND:
      result := 'EDS_ERR_DIR_NOT_FOUND { Directory does not exist }';
    EDS_ERR_DIR_IO_ERROR:
      result := 'EDS_ERR_DIR_IO_ERROR { I/O error }';
    EDS_ERR_DIR_ENTRY_NOT_FOUND:
      result := 'EDS_ERR_DIR_ENTRY_NOT_FOUND { No file in directroy }';
    EDS_ERR_DIR_ENTRY_EXISTS:
      result := 'EDS_ERR_DIR_ENTRY_EXISTS { File in directory }';
    EDS_ERR_DIR_NOT_EMPTY:
      result := 'EDS_ERR_DIR_NOT_EMPTY { Directory full }';
    // Property errors
    EDS_ERR_PROPERTIES_UNAVAILABLE:
      result := 'EDS_ERR_PROPERTIES_UNAVAILABLE { Property unavailable }';
    EDS_ERR_PROPERTIES_MISMATCH:
      result := 'EDS_ERR_PROPERTIES_MISMATCH { Property mismatch }';
    EDS_ERR_PROPERTIES_NOT_LOADED:
      result := 'EDS_ERR_PROPERTIES_NOT_LOADED { Property not loaded }';
    // Function Parameter errors
    EDS_ERR_INVALID_PARAMETER:
      result := 'EDS_ERR_INVALID_PARAMETER { Invalid function parameter }';
    EDS_ERR_INVALID_HANDLE:
      result := 'EDS_ERR_INVALID_HANDLE { Handle error }';
    EDS_ERR_INVALID_POINTER:
      result := 'EDS_ERR_INVALID_POINTER { Pointer error }';
    EDS_ERR_INVALID_INDEX:
      result := 'EDS_ERR_INVALID_INDEX { Index error }';
    EDS_ERR_INVALID_LENGTH:
      result := 'EDS_ERR_INVALID_LENGTH { Length error }';
    EDS_ERR_INVALID_FN_POINTER:
      result := 'EDS_ERR_INVALID_FN_POINTER { Function pointer error }';
    EDS_ERR_INVALID_SORT_FN:
      result := 'EDS_ERR_INVALID_SORT_FN { Sort functoin error }';
    { Device errors }
    EDS_ERR_DEVICE_NOT_FOUND:
      result := 'EDS_ERR_DEVICE_NOT_FOUND { Device not found }';
    EDS_ERR_DEVICE_BUSY:
      result := 'EDS_ERR_DEVICE_BUSY { Device busy }';
    EDS_ERR_DEVICE_INVALID:
      result := 'EDS_ERR_DEVICE_INVALID { Device error }';
    EDS_ERR_DEVICE_EMERGENCY:
      result := 'EDS_ERR_DEVICE_EMERGENCY { Device emergency }';
    EDS_ERR_DEVICE_MEMORY_FULL:
      result := 'EDS_ERR_DEVICE_MEMORY_FULL { Device memory full }';
    EDS_ERR_DEVICE_INTERNAL_ERROR:
      result := 'EDS_ERR_DEVICE_INTERNAL_ERROR { Internal device error }';
    EDS_ERR_DEVICE_INVALID_PARAMETER:
      result := 'EDS_ERR_DEVICE_INVALID_PARAMETER { Device invalid parameter }';
    EDS_ERR_DEVICE_NO_DISK:
      result := 'EDS_ERR_DEVICE_NO_DISK { No Disk }';
    EDS_ERR_DEVICE_DISK_ERROR:
      result := 'EDS_ERR_DEVICE_DISK_ERROR { Disk error }';
    EDS_ERR_DEVICE_CF_GATE_CHANGED:
      result := 'EDS_ERR_DEVICE_CF_GATE_CHANGED { The CF gate has been changed }';
    EDS_ERR_DEVICE_DIAL_CHANGED:
      result := 'EDS_ERR_DEVICE_DIAL_CHANGED { The dial has been changed }';
    EDS_ERR_DEVICE_NOT_INSTALLED:
      result := 'EDS_ERR_DEVICE_NOT_INSTALLED { Device not installed }';
    EDS_ERR_DEVICE_STAY_AWAKE:
      result := 'EDS_ERR_DEVICE_STAY_AWAKE { Device connected in awake mode }';
    EDS_ERR_DEVICE_NOT_RELEASED:
      result := 'EDS_ERR_DEVICE_NOT_RELEASED { Device not released }';
    { Stream errors }
    EDS_ERR_STREAM_IO_ERROR:
      result := 'EDS_ERR_STREAM_IO_ERROR { Stream I/O error }';
    EDS_ERR_STREAM_NOT_OPEN:
      result := 'EDS_ERR_STREAM_NOT_OPEN { Stream open error }';
    EDS_ERR_STREAM_ALREADY_OPEN:
      result := 'EDS_ERR_STREAM_ALREADY_OPEN { Stream already open }';
    EDS_ERR_STREAM_OPEN_ERROR:
      result := 'EDS_ERR_STREAM_OPEN_ERROR { Failed to open stream }';
    EDS_ERR_STREAM_CLOSE_ERROR:
      result := 'EDS_ERR_STREAM_CLOSE_ERROR { Failed to close stream }';
    EDS_ERR_STREAM_SEEK_ERROR:
      result := 'EDS_ERR_STREAM_SEEK_ERROR { Stream seek error }';
    EDS_ERR_STREAM_TELL_ERROR:
      result := 'EDS_ERR_STREAM_TELL_ERROR { Stream tell error }';
    EDS_ERR_STREAM_READ_ERROR:
      result := 'EDS_ERR_STREAM_READ_ERROR { Failed to read stream }';
    EDS_ERR_STREAM_WRITE_ERROR:
      result := 'EDS_ERR_STREAM_WRITE_ERROR { Failed to write stream }';
    EDS_ERR_STREAM_PERMISSION_ERROR:
      result := 'EDS_ERR_STREAM_PERMISSION_ERROR { Permission error }';
    EDS_ERR_STREAM_COULDNT_BEGIN_THREAD:
      result := 'EDS_ERR_STREAM_COULDNT_BEGIN_THREAD { Could not start reading thumbnail }';
    EDS_ERR_STREAM_BAD_OPTIONS:
      result := 'EDS_ERR_STREAM_BAD_OPTIONS { Invalid stream option }';
    EDS_ERR_STREAM_END_OF_STREAM:
      result := 'EDS_ERR_STREAM_END_OF_STREAM { Invalid stream termination }';
    { Communications errors }
    EDS_ERR_COMM_PORT_IS_IN_USE:
      result := 'EDS_ERR_COMM_PORT_IS_IN_USE { Port in use }';
    EDS_ERR_COMM_DISCONNECTED:
      result := 'EDS_ERR_COMM_DISCONNECTED { Port disconnected }';
    EDS_ERR_COMM_DEVICE_INCOMPATIBLE:
      result := 'EDS_ERR_COMM_DEVICE_INCOMPATIBLE { Incompatible device }';
    EDS_ERR_COMM_BUFFER_FULL:
      result := 'EDS_ERR_COMM_BUFFER_FULL { Buffer full }';
    EDS_ERR_COMM_USB_BUS_ERR:
      result := 'EDS_ERR_COMM_USB_BUS_ERR { USB bus error }';
    { Lock/Unlock }
    EDS_ERR_USB_DEVICE_LOCK_ERROR:
      result := 'EDS_ERR_USB_DEVICE_LOCK_ERROR { Failed to lock the UI }';
    EDS_ERR_USB_DEVICE_UNLOCK_ERROR:
      result := 'EDS_ERR_USB_DEVICE_UNLOCK_ERROR { Failed to unlock the UI }';
    { STI/WIA (Windows) }
    EDS_ERR_STI_UNKNOWN_ERROR:
      result := 'EDS_ERR_STI_UNKNOWN_ERROR { Unknown STI }';
    EDS_ERR_STI_INTERNAL_ERROR:
      result := 'EDS_ERR_STI_INTERNAL_ERROR { Internal STI error }';
    EDS_ERR_STI_DEVICE_CREATE_ERROR:
      result := 'EDS_ERR_STI_DEVICE_CREATE_ERROR { Device creation error }';
    EDS_ERR_STI_DEVICE_RELEASE_ERROR:
      result := 'EDS_ERR_STI_DEVICE_RELEASE_ERROR { Device release error }';
    EDS_ERR_DEVICE_NOT_LAUNCHED:
      result := 'EDS_ERR_DEVICE_NOT_LAUNCHED { Device startup faild }';
    { OTHER General error }
    EDS_ERR_ENUM_NA:
      result := 'EDS_ERR_ENUM_NA { Enumeration terminated }';
    EDS_ERR_INVALID_FN_CALL:
      result := 'EDS_ERR_INVALID_FN_CALL { Called in a mode when the function could not be used }';
    EDS_ERR_HANDLE_NOT_FOUND:
      result := 'EDS_ERR_HANDLE_NOT_FOUND { Handle not found }';
    EDS_ERR_INVALID_ID:
      result := 'EDS_ERR_INVALID_ID { Invalid ID }';
    EDS_ERR_WAIT_TIMEOUT_ERROR:
      result := 'EDS_ERR_WAIT_TIMEOUT_ERROR { Time out }';
    EDS_ERR_LAST_GENERIC_ERROR_PLUS_ONE:
      result := 'EDS_ERR_LAST_GENERIC_ERROR_PLUS_ONE { Not used }';
    { PTP }
    EDS_ERR_SESSION_NOT_OPEN:
      result := 'EDS_ERR_SESSION_NOT_OPEN';
    EDS_ERR_INVALID_TRANSACTIONID:
      result := 'EDS_ERR_INVALID_TRANSACTIONID';
    EDS_ERR_INCOMPLETE_TRANSFER:
      result := 'EDS_ERR_INCOMPLETE_TRANSFER';
    EDS_ERR_INVALID_STRAGEID:
      result := 'EDS_ERR_INVALID_STRAGEID';
    EDS_ERR_DEVICEPROP_NOT_SUPPORTED:
      result := 'EDS_ERR_DEVICEPROP_NOT_SUPPORTED';
    EDS_ERR_INVALID_OBJECTFORMATCODE:
      result := 'EDS_ERR_INVALID_OBJECTFORMATCODE';
    EDS_ERR_SELF_TEST_FAILED:
      result := 'EDS_ERR_SELF_TEST_FAILED';
    EDS_ERR_PARTIAL_DELETION:
      result := 'EDS_ERR_PARTIAL_DELETION';
    EDS_ERR_SPECIFICATION_BY_FORMAT_UNSUPPORTED:
      result := 'EDS_ERR_SPECIFICATION_BY_FORMAT_UNSUPPORTED';
    EDS_ERR_NO_VALID_OBJECTINFO:
      result := 'EDS_ERR_NO_VALID_OBJECTINFO';
    EDS_ERR_INVALID_CODE_FORMAT:
      result := 'EDS_ERR_INVALID_CODE_FORMAT';
    EDS_ERR_UNKNOWN_VENDER_CODE:
      result := 'EDS_ERR_UNKNOWN_VENDER_CODE';
    EDS_ERR_CAPTURE_ALREADY_TERMINATED:
      result := 'EDS_ERR_CAPTURE_ALREADY_TERMINATED';
    EDS_ERR_INVALID_PARENTOBJECT:
      result := 'EDS_ERR_INVALID_PARENTOBJECT';
    EDS_ERR_INVALID_DEVICEPROP_FORMAT:
      result := 'EDS_ERR_INVALID_DEVICEPROP_FORMAT';
    EDS_ERR_INVALID_DEVICEPROP_VALUE:
      result := 'EDS_ERR_INVALID_DEVICEPROP_VALUE';
    EDS_ERR_SESSION_ALREADY_OPEN:
      result := 'EDS_ERR_SESSION_ALREADY_OPEN';
    EDS_ERR_TRANSACTION_CANCELLED:
      result := 'EDS_ERR_TRANSACTION_CANCELLED';
    EDS_ERR_SPECIFICATION_OF_DESTINATION_UNSUPPORTED:
      result := 'EDS_ERR_SPECIFICATION_OF_DESTINATION_UNSUPPORTED';
    { PTP Vendor }
    EDS_ERR_UNKNOWN_COMMAND:
      result := 'EDS_ERR_UNKNOWN_COMMAND';
    EDS_ERR_OPERATION_REFUSED:
      result := 'EDS_ERR_OPERATION_REFUSED';
    EDS_ERR_LENS_COVER_CLOSE:
      result := 'EDS_ERR_LENS_COVER_CLOSE';
    EDS_ERR_LOW_BATTERY:
      result := 'EDS_ERR_LOW_BATTERY                        	';
    EDS_ERR_OBJECT_NOTREADY:
      result := 'EDS_ERR_OBJECT_NOTREADY			';
    { Capture Error }
    EDS_ERR_TAKE_PICTURE_AF_NG:
      result := 'EDS_ERR_TAKE_PICTURE_AF_NG';
    EDS_ERR_TAKE_PICTURE_RESERVED:
      result := 'EDS_ERR_TAKE_PICTURE_RESERVED';
    EDS_ERR_TAKE_PICTURE_MIRROR_UP_NG:
      result := 'EDS_ERR_TAKE_PICTURE_MIRROR_UP_NG';
    EDS_ERR_TAKE_PICTURE_SENSOR_CLEANING_NG:
      result := 'EDS_ERR_TAKE_PICTURE_SENSOR_CLEANING_NG';
    EDS_ERR_TAKE_PICTURE_SILENCE_NG:
      result := 'EDS_ERR_TAKE_PICTURE_SILENCE_NG';
    EDS_ERR_TAKE_PICTURE_NO_CARD_NG:
      result := 'EDS_ERR_TAKE_PICTURE_NO_CARD_NG';
    EDS_ERR_TAKE_PICTURE_CARD_NG:
      result := 'EDS_ERR_TAKE_PICTURE_CARD_NG';
    EDS_ERR_TAKE_PICTURE_CARD_PROTECT_NG:
      result := 'EDS_ERR_TAKE_PICTURE_CARD_PROTECT_NG';
  else
    result := 'Uknown Error (' + IntToStr(ErrNum) + ')';
  end;
end;

function TCanonCamera.SynchroPropertyDateTime(): Boolean;
var
  timenow: TDateTime;
  y, m, d, h, mn, s, ms: word;

  EDS_Time: EdsTime;
begin
  result := False;
  timenow := Now;
  DecodeDate(timenow, y, m, d);
  DecodeTime(timenow, h, mn, s, ms);
  EDS_Time.year := y;
  EDS_Time.month := m;
  EDS_Time.day := d;
  EDS_Time.hour := h;
  EDS_Time.minute := mn;
  EDS_Time.second := s;
  EDS_Time.milliseconds := ms;

  Self.LastError := EdsSetPropertyData(Self.FEdsCameraRef, kEdsPropID_DateTime,
    0, sizeof(EdsTime), @EDS_Time);
  result := (Self.LastError = EDS_ERR_OK);
end;

function TCanonCamera.ReadPropertyDateTime(): TDateTime;
var
  dataSize: EdsUInt32;
  dataType: EdsDataType;
  P: Pointer;
  EDS_Time: EdsTime;
  DeviceSystemTime: TDateTime;
begin
  result := 0;
  FDateTime := 0;
  DeviceSystemTime := 0;
  if not FIsConnected then
    Exit;

  try
    Self.LastError := EdsGetPropertySize(Self.FEdsCameraRef,
      kEdsPropID_DateTime, 0, dataType, dataSize);
    if Self.LastError <> EDS_ERR_OK then
      Exit;

    if dataType <> EdsDataType(kEdsDataType_Time) then
      // If not a AnsiString We're using the wrong function
      Exit;

    P := @EDS_Time;
    Self.LastError := EdsGetPropertyData(Self.FEdsCameraRef,
      kEdsPropID_DateTime, 0, dataSize, Pointer(P^));
    if Self.LastError <> EDS_ERR_OK then
      Exit;
    DeviceSystemTime := EncodeTime(EDS_Time.hour, EDS_Time.minute,
      EDS_Time.second, EDS_Time.milliseconds) + EncodeDate(EDS_Time.year,
      EDS_Time.month, EDS_Time.day);
  finally
    FDateTime := DeviceSystemTime;
    result := FDateTime;
  end;
end;


// function TCanonCamera.WritePropertyEdsUInt32(PropertyID: EdsPropertyID;
// PropertyValue: EdsUInt32): Boolean;
// begin
// Result := False;
//
// if not FIsConnected then
// Exit;
//
// { When setting properties in type 1 protocol standard cameras, take steps to
// prevent contention with camera operations, such as by locking the UI. On the
// other hand, for type 2 protocol standard cameras, the UI can be locked or
// unlocked on the camera itself, so do not lock the UI. }
// if FIsLegacy then
// begin
// Self.LastError := EdsSendStatusCommand(Self.FEdsCameraRef,
// kEdsCameraState_UILock, 0);
// if Self.LastError <> EDS_ERR_OK then
// Exit;
// FIsLocked := True;
// end;
//
// Self.LastError := EdsSetPropertyData(Self.FEdsCameraRef, PropertyID, 0,
// sizeof(PropertyValue), @PropertyValue);
// if Self.LastError <> EDS_ERR_OK then
// Exit;
//
// if FIsLegacy then
// begin
// if FIsLocked then
// begin
// Self.LastError := EdsSendStatusCommand(Self.FEdsCameraRef,
// kEdsCameraState_UIUnLock, 0);
// if Self.LastError <> EDS_ERR_OK then
// Exit;
// FIsLocked := False;
// end;
// end;
//
// Result := True;
// end;

function TCanonCamera.GetShutterCounter(): integer;
asm
  push    ebx
  push    esi
  push    edi
  mov     ecx, Self.FEdsCameraRef
  mov     eax, [ecx+14h]
  test    eax, eax
  jz      @@Error
  mov     edi, [eax+4]
  mov     ecx, eax
  mov     eax, [edi]
  mov     edx, eax
  and     ecx, 80000000h
  and     edx, 80000000h
  cmp     edx, ecx
  jnz     @@Error
  test    eax, eax
  jz      @@Error

@loop_01:
  mov     edx, [eax]
  mov     esi, edx
  and     esi, 80000000h
  cmp     esi, ecx
  jnz     @loop_02
  add     eax, 8
  mov     ebx, eax
  and     ebx, 80000000h
  cmp     ebx, ecx
  jnz     @loop_02
  test    eax, eax
  jz      @loop_02
  mov     eax, [eax]
  mov     ebx, eax
  and     ebx, 80000000h
  cmp     ebx, ecx
  jnz     @loop_02
  test    eax, eax
  jz      @loop_02
  movzx   ebx, word ptr [eax]
  cmp     ebx, kEdsPropID_ShutterCounter
  jnz     @loop_02
  add     eax, 0Ch
  jnz     @sub_001

@loop_02:
  mov     eax, edx
  test    edx, edx
  jz      @@Error
  cmp     esi, ecx
  jnz     @@Error
  cmp     edx, edi
  jnz     @loop_01
  jmp     @@Error

@sub_001:
  mov     eax, [eax]
  mov     edx, eax
  and     edx, 80000000h
  cmp     edx, ecx
  jnz     @@Error
  test    eax, eax
  jnz     @@exit

@@Error:
  xor     eax, eax

@@exit:
  mov   eax,[eax]
  pop     edi
  pop     esi
  pop     ebx
end;

function TCanonCamera.WritePropertyString(PropertyID: EdsPropertyID;
  s: PAnsiChar): Boolean;
begin
  Self.LastError := EdsSetPropertyData(Self.FEdsCameraRef, PropertyID, 0,
    StrLen(s) + 1, s);
  result := (Self.LastError = EDS_ERR_OK);
end;

function TCanonCamera.ReadPropertyString(PropertyID: EdsPropertyID): AnsiString;
var
  dataSize: EdsUInt32;
  dataType: EdsDataType;
  P: Pointer;
  str: array [0 .. 255] of EdsChar;
begin
  result := AnsiString('');
  str := AnsiString('');
  Self.LastError := EdsGetPropertySize(Self.FEdsCameraRef, PropertyID, 0,
    dataType, dataSize);
  if Self.LastError <> EDS_ERR_OK then
    Exit;

  if dataType <> EdsDataType(kEdsDataType_String) then
    // If not a AnsiString We're using the wrong function
    Exit;

  P := @str;
  Self.LastError := EdsGetPropertyData(Self.FEdsCameraRef, PropertyID, 0,
    dataSize, Pointer(P^));
  if Self.LastError <> EDS_ERR_OK then
    Exit;
  result := str;
end;

end.
