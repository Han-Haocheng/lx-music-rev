import {
  ref,
  reactive,
  computed,
  watch,
  watchEffect,
  nextTick,
  onMounted,
  onBeforeUnmount,
  toRaw,
  useCssModule,
  toRef,
  toRefs,
  shallowRef,
  unref,
  markRaw,
  type ComputedRef,
  type Ref,
  type ShallowRef,
  shallowReactive,
  withDefaults,
} from 'vue'

export const markRawList = <T extends any[]>(list: T) => {
  for (const item of list) {
    markRaw(item)
  }
  return list
}

export {
  nextTick,
  onBeforeUnmount,
  ref,
  toRaw,
  reactive,
  watch,
  watchEffect,
  computed,
  useCssModule,
  toRef,
  toRefs,
  shallowRef,
  unref,
  onMounted,
  markRaw,
  shallowReactive,
  withDefaults,
}

export type {
  ComputedRef,
  Ref,
  ShallowRef,
}
