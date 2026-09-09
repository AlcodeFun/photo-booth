{ /******************************************************************************
  *                                                                             *
  *   PROJECT : EOS Digital Software Development Kit EDSDK                      *
  *      NAME : EDSDK.h                                                         *
  *                                                                             *
  *   Description: PROTO TYPE DEFINITION OF EDSDK API                           *
  *                                                                             *
  *******************************************************************************
  *                                                                             *
  *   Written and developed by Canon Inc.										  *
  *   Copyright Canon Inc. 2006-2016 All Rights Reserved                        *
  *                                                                             *
  ******************************************************************************/ }
unit EDSDKApi;

interface

uses
  EDSDKType, EDSDKError, Windows, SysUtils;

const
  edsdk_DLL = 'EDSDK.DLL'; // 'EDSDKN.DLL';

  {
    *****************************************************************************
    *******************************************************************************
    //
    //  Basic functions
    //
    *******************************************************************************
    *****************************************************************************
  }
  {
    ******************************************************************************
    ********************* Initialize / Terminate Function ************************
    ******************************************************************************
  }
  {
    -----------------------------------------------------------------------------
    //
    //  Function:   EdsInitializeSDK
    //
    //  Description:
    //      Initializes the libraries.
    //      When using the EDSDK libraries, you must call this API once
    //          before using EDSDK APIs.
    //
    //  Parameters:
    //       In:    None
    //      Out:    None
    //
    //  Returns:    Any of the sdk errors.
    -----------------------------------------------------------------------------
  }

function EdsInitializeSDK(): EdsError; stdcall; external edsdk_DLL;

{
  -----------------------------------------------------------------------------
  //
  //  Function:   EdsTerminateSDK
  //
  //  Description:
  //      Terminates use of the libraries.
  //      This function muse be called when ending the SDK.
  //      Calling this function releases all resources allocated by the libraries.
  //
  //  Parameters:
  //       In:    None
  //      Out:    None
  //
  //  Returns:    Any of the sdk errors.
  -----------------------------------------------------------------------------
}
function EdsTerminateSDK(): EdsError; stdcall; external edsdk_DLL;

{
  ******************************************************************************
  *********************** Referense Count Function *****************************
  ******************************************************************************
}
{
  -----------------------------------------------------------------------------
  //
  //  Function:   EdsRetain
  //
  //  Description:
  //      Increments the reference counter of existing objects.
  //
  //  Parameters:
  //       In:    inRef - The reference for the item.
  //      Out:    None
  //
  //  Returns:    Any of the sdk errors.
  -----------------------------------------------------------------------------
}

function EdsRetain(inRef: EdsBaseRef): EdsUInt32; stdcall; external edsdk_DLL;

{
  -----------------------------------------------------------------------------
  //
  //  Function:   EdsRelease
  //
  //  Description:
  //      Decrements the reference counter to an object.
  //      When the reference counter reaches 0, the object is released.
  //
  //  Parameters:
  //       In:    inRef - The reference of the item.
  //      Out:    None
  //  Returns:    Any of the sdk errors.
  -----------------------------------------------------------------------------
}
function EdsRelease(inRef: EdsBaseRef): EdsUInt32; stdcall; external edsdk_DLL;

{
  ******************************************************************************
  ************************** Item Tree Handling Function ***********************
  ******************************************************************************
}
{
  -----------------------------------------------------------------------------
  //
  //  Function:   EdsGetChildCount
  //
  //  Description:
  //      Gets the number of child objects of the designated object.
  //      Example: Number of files in a directory
  //
  //  Parameters:
  //       In:    inRef - The reference of the list.
  //      Out:    outCount - Number of elements in this list.
  //
  //  Returns:    Any of the sdk errors.
  -----------------------------------------------------------------------------
}
function EdsGetChildCount(inRef: EdsBaseRef; var outCount: EdsUInt32): EdsError;
  stdcall; external edsdk_DLL;

{
  -----------------------------------------------------------------------------
  //
  //  Function:   EdsGetChildAtIndex
  //
  //  Description:
  //       Gets an indexed child object of the designated object.
  //
  //  Parameters:
  //       In:    inRef - The reference of the item.
  //              inIndex -  The index that is passed in, is zero based.
  //      Out:    outRef - The pointer which receives reference of the
  //                           specified index .
  //
  //  Returns:    Any of the sdk errors.
  -----------------------------------------------------------------------------
}
function EdsGetChildAtIndex(inRef: EdsBaseRef; inIndex: EdsInt32;
  var outBaseRef: EdsBaseRef): EdsError; stdcall; external edsdk_DLL;

{
  ******************************************************************************
  ******************************* Property Function ****************************
  ******************************************************************************
}
{
  -----------------------------------------------------------------------------
  //
  //  Function:   EdsGetPropertySize
  //
  //  Description:
  //      Gets the byte size and data type of a designated property
  //          from a camera object or image object.
  //
  //  Parameters:
  //       In:    inRef - The reference of the item.
  //              inPropertyID - The ProprtyID
  //              inParam - Additional information of property.
  //                   We use this parameter in order to specify an index
  //                   in case there are two or more values over the same ID.
  //      Out:    outDataType - Pointer to the buffer that is to receive the property
  //                        type data.
  //              outSize - Pointer to the buffer that is to receive the property
  //                        size.
  //
  //  Returns:    Any of the sdk errors.
  -----------------------------------------------------------------------------
}
function EdsGetPropertySize(inRef: EdsBaseRef; inPropertyID: EdsPropertyID;
  inParam: EdsInt32; var outDataType: EdsDataType; var outSize: EdsUInt32)
  : EdsError; stdcall; external edsdk_DLL;

{
  -----------------------------------------------------------------------------
  //
  //  Function:   EdsGetPropertyData
  //
  //  Description:
  //      Gets property information from the object designated in inRef.
  //
  //  Parameters:
  //       In:    inRef - The reference of the item.
  //              inPropertyID - The ProprtyID
  //              inParam - Additional information of property.
  //                   We use this parameter in order to specify an index
  //                   in case there are two or more values over the same ID.
  //              inPropertySize - The number of bytes of the prepared buffer
  //                  for receive property-value.
  //       Out:   outPropertyData - The buffer pointer to receive property-value.
  //
  //  Returns:    Any of the sdk errors.
  -----------------------------------------------------------------------------
}
function EdsGetPropertyData(inRef: EdsBaseRef; inPropertyID: EdsPropertyID;
  inParam: EdsInt32; inPropertySize: EdsUInt32; var outPropertyData: Pointer)
  : EdsError; stdcall; external edsdk_DLL;

{
  -----------------------------------------------------------------------------
  //
  //  Function:   EdsSetPropertyData
  //
  //  Description:
  //      Sets property data for the object designated in inRef.
  //
  //  Parameters:
  //       In:    inRef - The reference of the item.
  //              inPropertyID - The ProprtyID
  //              inParam - Additional information of property.
  //              inPropertySize - The number of bytes of the prepared buffer
  //                  for set property-value.
  //              inPropertyData - The buffer pointer to set property-value.
  //      Out:    None
  //
  //  Returns:    Any of the sdk errors.
  -----------------------------------------------------------------------------
}
function EdsSetPropertyData(inRef: EdsBaseRef; inPropertyID: EdsPropertyID;
  inParam: EdsInt32; inPropertySize: EdsUInt32; InPropertyData: Pointer)
  : EdsError; stdcall; external edsdk_DLL;

{
  ******************************************************************************
  ******************** Device List and Device Operation Function ***************
  ******************************************************************************
}
{
  -----------------------------------------------------------------------------
  //
  //  Function:   EdsGetCameraList
  //
  //  Description:
  //      Gets camera list objects.
  //
  //  Parameters:
  //       In:    None
  //      Out:    outCameraListRef - Pointer to the camera-list.
  //
  //  Returns:    Any of the sdk errors.
  -----------------------------------------------------------------------------
}
function EdsGetCameraList(var outCameraListRef: EdsCameraListRef): EdsError;
  stdcall; external edsdk_DLL;

{
  -----------------------------------------------------------------------------
  //
  //  Function:   EdsGetDeviceInfo
  //
  //  Description:
  //      Gets device information, such as the device name.
  //      Because device information of remote cameras is stored
  //          on the host computer, you can use this API
  //          before the camera object initiates communication
  //          (that is, before a session is opened).
  //
  //  Parameters:
  //       In:    inCameraRef - The reference of the camera.
  //      Out:    outDeviceInfo - Information as device of camera.
  //
  //  Returns:    Any of the sdk errors.
  -----------------------------------------------------------------------------
}
function EdsGetDeviceInfo(inCameraRef: EdsCameraRef;
  var outDeviceInfo: EdsDeviceInfo): EdsError; stdcall; external edsdk_DLL;

{
  ******************************************************************************
  ************************* Camera Operation Function **************************
  ******************************************************************************
}
{
  -----------------------------------------------------------------------------
  //
  //  Function:   EdsOpenSession
  //
  //  Description:
  //      Establishes a logical connection with a remote camera.
  //      Use this API after getting the camera's EdsCamera object.
  //
  //  Parameters:
  //       In:    inCameraRef - The reference of the camera
  //      Out:    None
  //
  //  Returns:    Any of the sdk errors.
  -----------------------------------------------------------------------------
}
function EdsOpenSession(inCameraRef: EdsCameraRef): EdsError; stdcall;
  external edsdk_DLL;

{
  -----------------------------------------------------------------------------
  //
  //  Function:   EdsCloseSession
  //
  //  Description:
  //       Closes a logical connection with a remote camera.
  //
  //  Parameters:
  //       In:    inCameraRef - The reference of the camera
  //      Out:    None
  //
  //  Returns:    Any of the sdk errors.
  -----------------------------------------------------------------------------
}
function EdsCloseSession(inCameraRef: EdsCameraRef): EdsError; stdcall;
  external edsdk_DLL;

{ -----------------------------------------------------------------------------
  Function : EdsSendCommand

  Description:
  Send the specified command to to the camera.

  Parameters:
  In: inCameraRef - The reference of the camera which will receive the command.
  inCommand   - Specifies the command to be sent.
  inParam     - Specifies additional command-specific information.
  Out: None

  Returns:
  Returns EDS_ERR_OK if successful. In other cases, see EDSDKError.pas.
  ----------------------------------------------------------------------------- }
function EdsSendCommand(inCameraRef: EdsCameraRef; inCommand: EdsCameraCommand;
  inParam: EdsInt32): EdsError; stdcall; external edsdk_DLL;

{ -----------------------------------------------------------------------------
  Function : EdsSendStatusCommand

  Description:
  Sets the remote camera state or mode.

  Parameters:
  In: inCameraRef     - The reference of the camera which will receive the
  command.
  inStatusCommand - Designate the particular mode ID to set the camera to.
  inParam         - Specifies additional command-specific information.
  Out: None

  Returns:
  Returns EDS_ERR_OK if successful. In other cases, see EDSDKError.pas.
  ----------------------------------------------------------------------------- }
function EdsSendStatusCommand(inCameraRef: EdsCameraRef;
  inStatusCommand: EdsCameraStateCommand; inParam: EdsInt32): EdsError; stdcall;
  external edsdk_DLL;

{
  ******************************************************************************
  ************************* Setup Operation Function ***************************
  ******************************************************************************
}


{
  /******************************************************************************
  *******************************************************************************
  //
  //  Event handler registering functions
  //
  *******************************************************************************
  ****************************************************************************** }

{
  ******************************************************************************
  *********************** Event Handler Setup Function *************************
  ******************************************************************************
}
{ -----------------------------------------------------------------------------
  //
  //  Function:   EdsSetCameraAddedHandler
  //
  //  Description:
  //      Registers a callback function for when a camera is detected.
  //
  //  Parameters:
  //       In:    inCameraAddedHandler - Pointer to a callback function
  //                          called when a camera is connected physically
  //              inContext - Specifies an application-defined value to be sent to
  //                          the callback function pointed to by CallBack parameter.
  //      Out:    None
  //
  //  Returns:    Any of the sdk errors.
  ----------------------------------------------------------------------------- }
function EdsSetCameraAddedHandler(inCameraAddedHandler: EdsCameraAddedHandler;
  inContext: EdsUInt32): EdsError; stdcall; external edsdk_DLL;

{
  -----------------------------------------------------------------------------
  // Function:   EdsSetPropertyEventHandler
  //
  // Description:
  // Registers a callback function for receiving status
  // change notification events for property states on a camera.
  -----------------------------------------------------------------------------
  //
  // Function:  EdsSetCameraStateEventHandler
  //
  // Description:
  // Registers a callback function for receiving status
  // change notification events for property states on a camera.
  //
  -----------------------------------------------------------------------------
  // Function:   EdsSetObjectEventHandler
  //
  // Description:
  // Registers a callback function for receiving status
  // change notification events for objects on a remote camera.
  // Here, object means volumes representing memory cards, files and directories,
  // and shot images stored in memory, in particular.
  //
  //
  //
  // Parameters:
  // In:    inCameraRef - Designate the camera object.
  // inEvent - Designate one or all events to be supplemented.
  // inPropertyEventHandler - Designate the pointer to the callback
  // function for receiving property-related camera events.
  // inContext - Designate application information to be passed by
  // means of the callback function. Any data needed for
  // your application can be passed.
  // Out:    None
  //
  // Returns:    Any of the sdk errors.
  ----------------------------------------------------------------------------- }
function EdsSetPropertyEventHandler(inCameraRef: EdsCameraRef;
  inEvent: EdsPropertyEvent; inPropertyEventHandler: Pointer;
  inContext: EdsUInt32): EdsError; stdcall; external edsdk_DLL;


function EdsSetCameraStateEventHandler(inCameraRef: EdsCameraRef;
  inEvent: EdsStateEvent; inStateEventHandler: Pointer; inContext: EdsUInt32)
  : EdsError; stdcall; external edsdk_DLL;

{ - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  //
  // Function:   EdsGetEvent
  //
  // Description:
  // This function acquires an event.
  // In console application, please call this function regularly to acquire
  // the event from a camera.
  //
  // Parameters:
  // In:    None
  // Out:    None
  //
  // Returns:    Any of the sdk errors.
  - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - }
function EdsGetEvent(): EdsError; stdcall; external edsdk_DLL; // 27

implementation

end.
