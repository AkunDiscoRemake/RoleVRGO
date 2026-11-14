--!strict
-- Definições de tipo do RoleVRGO Studio para luau-lsp (VS Code).
-- No settings.json do VS Code: "luau-lsp.types.definitionFiles": ["rolevrgo.d.luau"], "luau-lsp.types.roblox": false

declare class Vector3
  X: number
  Y: number
  Z: number
  Magnitude: number
  Unit: Vector3
  function Dot(self, other: Vector3): number
  function Cross(self, other: Vector3): Vector3
  function Lerp(self, goal: Vector3, alpha: number): Vector3
  function __add(self, other: Vector3): Vector3
  function __sub(self, other: Vector3): Vector3
  function __mul(self, other: Vector3 | number): Vector3
  function __div(self, other: Vector3 | number): Vector3
  function __unm(self): Vector3
end
declare Vector3: { new: (x: number?, y: number?, z: number?) -> Vector3, zero: Vector3, one: Vector3, xAxis: Vector3, yAxis: Vector3, zAxis: Vector3 }

declare class Color3
  R: number
  G: number
  B: number
  function Lerp(self, goal: Color3, alpha: number): Color3
end
declare Color3: { new: (r: number?, g: number?, b: number?) -> Color3, fromRGB: (r: number?, g: number?, b: number?) -> Color3, fromHSV: (h: number, s: number, v: number) -> Color3 }

type UDim = { Scale: number, Offset: number }
type UDim2 = { X: UDim, Y: UDim }
declare UDim2: { new: (xs: number?, xo: number?, ys: number?, yo: number?) -> UDim2, fromScale: (x: number, y: number) -> UDim2, fromOffset: (x: number, y: number) -> UDim2 }
type CFrame = { Position: Vector3 }
declare CFrame: { new: ((x: number, y: number, z: number) -> CFrame) & ((pos: Vector3) -> CFrame) }
type TweenInfo = { Time: number, Reverses: boolean, RepeatCount: number, DelayTime: number }
declare TweenInfo: { new: (time: number?, style: any?, direction: any?, repeatCount: number?, reverses: boolean?, delayTime: number?) -> TweenInfo }
declare BrickColor: { new: (name: string) -> { Color: Color3, Name: string } }

type KeyCode = { Name: string }
declare Enum: {
  KeyCode: { [string]: KeyCode },
  PartType: { Block: string, Ball: string, Cylinder: string },
  UserInputType: { Keyboard: string, MouseButton1: string, Touch: string },
  Material: { [string]: string },
  EasingStyle: { [string]: string },
  EasingDirection: { [string]: string },
}

type Connection = { Connected: boolean, Disconnect: () -> () }
declare class RBXScriptSignal
  function Connect(self, callback: (...any) -> ()): Connection
  function Once(self, callback: (...any) -> ()): Connection
  function Wait(self): ...any
end

declare class Instance
  Name: string
  ClassName: string
  Parent: Instance?
  Changed: RBXScriptSignal
  ChildAdded: RBXScriptSignal
  ChildRemoved: RBXScriptSignal
  AncestryChanged: RBXScriptSignal
  Destroying: RBXScriptSignal
  function IsA(self, className: string): boolean
  function GetChildren(self): { Instance }
  function GetDescendants(self): { Instance }
  function FindFirstChild(self, name: string, recursive: boolean?): Instance?
  function FindFirstChildOfClass(self, className: string): Instance?
  function FindFirstAncestor(self, name: string): Instance?
  function WaitForChild(self, name: string, timeout: number?): Instance
  function Destroy(self): ()
  function ClearAllChildren(self): ()
  function Clone(self): Instance
  function GetFullName(self): string
  function SetAttribute(self, key: string, value: any): ()
  function GetAttribute(self, key: string): any
  function GetPropertyChangedSignal(self, property: string): RBXScriptSignal
end

declare class BasePart extends Instance
  Position: Vector3
  Size: Vector3
  Orientation: Vector3
  Color: Color3
  BrickColor: any
  Transparency: number
  Anchored: boolean
  CanCollide: boolean
  Shape: string
  Material: string
  Velocity: Vector3
  CFrame: CFrame
  Touched: RBXScriptSignal
  TouchEnded: RBXScriptSignal
  function ApplyImpulse(self, impulse: Vector3): ()
  function PivotTo(self, cf: CFrame): ()
  function GetPivot(self): CFrame
  function MoveTo(self, pos: Vector3): ()
end
declare class Part extends BasePart end

declare class Humanoid extends Instance
  Health: number
  MaxHealth: number
  WalkSpeed: number
  JumpPower: number
  Died: RBXScriptSignal
  HealthChanged: RBXScriptSignal
  function TakeDamage(self, amount: number): ()
  function MoveTo(self, pos: Vector3): ()
end

declare class GuiObject extends Instance
  Position: UDim2
  Size: UDim2
  Visible: boolean
  BackgroundColor3: Color3
  BackgroundTransparency: number
end
declare class TextLabel extends GuiObject
  Text: string
  TextSize: number
  TextColor3: Color3
end
declare class TextButton extends TextLabel
  Activated: RBXScriptSignal
  MouseButton1Click: RBXScriptSignal
end
declare class ImageLabel extends GuiObject
  Image: string
end
declare class ScreenGui extends Instance
  Enabled: boolean
end
declare class Sound extends Instance
  SoundId: string
  Volume: number
  function Play(self): ()
  function Stop(self): ()
end
declare class RemoteEvent extends Instance
  OnServerEvent: RBXScriptSignal
  OnClientEvent: RBXScriptSignal
  function FireServer(self, ...: any): ()
  function FireClient(self, player: Player, ...: any): ()
  function FireAllClients(self, ...: any): ()
end
declare class RemoteFunction extends Instance
  OnServerInvoke: (player: Player, ...any) -> ...any
  function InvokeServer(self, ...: any): ...any
end
declare class BindableEvent extends Instance
  Event: RBXScriptSignal
  function Fire(self, ...: any): ()
end
declare class BindableFunction extends Instance
  OnInvoke: (...any) -> ...any
  function Invoke(self, ...: any): ...any
end
declare class ClickDetector extends Instance
  MaxActivationDistance: number
  MouseClick: RBXScriptSignal
end
declare class ProximityPrompt extends Instance
  ActionText: string
  ObjectText: string
  KeyboardKeyCode: KeyCode
  MaxActivationDistance: number
  Enabled: boolean
  Triggered: RBXScriptSignal
  TriggerEnded: RBXScriptSignal
end
declare class Explosion extends Instance
  Position: Vector3
  BlastRadius: number
  DestroyJointRadiusPercent: number
  Hit: RBXScriptSignal
end
type RaycastResult = { Instance: BasePart, Position: Vector3, Normal: Vector3, Distance: number }
type RaycastParams = { FilterDescendantsInstances: { Instance }, FilterType: any }
declare RaycastParams: { new: () -> RaycastParams }
declare class GlobalDataStore
  function GetAsync(self, key: string): any
  function SetAsync(self, key: string, value: any): any
  function UpdateAsync(self, key: string, transform: (any) -> any): any
  function IncrementAsync(self, key: string, delta: number?): number
  function RemoveAsync(self, key: string): any
end
declare class OrderedDataStore extends GlobalDataStore
  function GetSortedAsync(self, ascending: boolean, pageSize: number): { GetCurrentPage: (any) -> { { key: string, value: number } }, IsFinished: boolean }
end
declare class Random
  function NextInteger(self, min: number, max: number): number
  function NextNumber(self, min: number?, max: number?): number
  function NextUnitVector(self): Vector3
  function Shuffle(self, t: { any }): ()
end
declare Random: { new: (seed: number?) -> Random }
declare class ValueBase extends Instance
  Value: any
end

declare class Player extends Instance
  UserId: number
  Character: Model
  PlayerGui: Instance
  Chatted: RBXScriptSignal
end
declare class Model extends Instance end

declare Instance: { new: (className: string, parent: Instance?) -> any }
declare game: any
declare workspace: any
declare script: Instance
declare task: {
  wait: (seconds: number?) -> number,
  spawn: (f: (...any) -> ...any, ...any) -> thread,
  delay: (seconds: number, f: (...any) -> ...any, ...any) -> (),
  defer: (f: (...any) -> ...any, ...any) -> (),
  cancel: (co: thread) -> (),
}
declare function wait(seconds: number?): number
declare function spawn(f: (...any) -> ...any): thread
declare function delay(seconds: number, f: (...any) -> ...any): ()
declare function tick(): number
declare function time(): number
declare function warn(...: any): ()
declare function require(module: any): any
declare function typeof(value: any): string

declare RoleVR: {
  isServer: boolean,
  toast: (text: string, cssColor: string?) -> (),
  banner: (text: string, seconds: number?) -> (),
  say: (text: string) -> (),
  sound: (name: string, volume: number?) -> (),
  effect: (pos: Vector3, color: Color3?, amount: number?) -> (),
  model: (key: string, pos: Vector3, scale: number?, yaw: number?) -> { Destroy: () -> () },
  npc: (name: string, pos: Vector3, lines: { string }?) -> (),
  fly: (on: boolean) -> (),
  sky: (color: Color3) -> (),
  emote: (id: number) -> (),
}
