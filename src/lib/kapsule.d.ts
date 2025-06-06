declare module 'kapsule' {
  export interface KapsuleProp {
    default?: any;
    triggerUpdate?: boolean;
    onChange?: (newVal: any, state: any) => void;
  }

  export interface KapsuleConfig<State = any> {
    props?: Record<string, KapsuleProp | any>;
    methods?: Record<string, (state: State, ...args: any[]) => any>;
    stateInit?: (options?: any) => State;
    init?: (domElement: any, state: State, options?: any) => void;
    update?: (state: State) => void;
  }

  export interface KapsuleInstance {
    (element?: HTMLElement): KapsuleInstance;
    resetProps(): KapsuleInstance;
    [key: string]: any;
  }

  export default function Kapsule<State = any>(
    config: KapsuleConfig<State>
  ): KapsuleInstance;
}