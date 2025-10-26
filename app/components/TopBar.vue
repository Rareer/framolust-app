<script setup lang="ts">
interface Props {
  selectedDevice: { deviceName: string; ip: string } | null
  isDeviceOnline: boolean
}

interface Emits {
  (e: 'open-api-key-modal'): void
  (e: 'open-device-setup'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// Power Control
const { isPoweredOn, isLoading: isPowerLoading, togglePower, fetchPowerStatus } = usePowerControl()

// Power-Status beim Gerätewechsel laden
watch(() => props.selectedDevice?.ip, async (newIp) => {
  if (newIp && props.isDeviceOnline) {
    await fetchPowerStatus(newIp)
  }
}, { immediate: true })

// Power Toggle Handler
const handlePowerToggle = async () => {
  if (!props.selectedDevice?.ip) return
  await togglePower(props.selectedDevice.ip)
}

// Computed: Status-Text und -Farbe
const deviceStatus = computed<{
  text: string
  color: 'success' | 'primary' | 'secondary' | 'info' | 'warning' | 'error' | 'neutral'
  icon: string
}>(() => {
  if (!props.selectedDevice) {
    return {
      text: 'Kein Gerät',
      color: 'neutral',
      icon: 'i-heroicons-cpu-chip'
    }
  }
  if (props.isDeviceOnline) {
    return {
      text: props.selectedDevice.deviceName,
      color: 'success',
      icon: 'i-heroicons-signal'
    }
  }
  return {
    text: `${props.selectedDevice.deviceName} (Offline)`,
    color: 'warning',
    icon: 'i-heroicons-signal-slash'
  }
})
</script>

<template>
  <div class="w-full border-b border-gray-800/50 bg-gray-900/30 backdrop-blur-sm">
    <div class="container mx-auto px-4">
      <div class="flex items-center justify-between h-16">
        <!-- Logo/Brand -->
        <div class="flex items-center gap-3">
          <div class="flex flex-col">
            <div class="text-xl sm:text-2xl font-bold bg-gradient-to-r from-indigo-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent">
              Framolux
            </div>
            <div class="h-0.5 w-16 bg-gradient-to-r from-indigo-500 to-transparent rounded-full"></div>
          </div>
        </div>
        
        <!-- Actions -->
        <div class="flex items-center gap-2">
          <!-- Power Button -->
          <UButton
            v-if="selectedDevice && isDeviceOnline"
            :icon="isPoweredOn ? 'i-heroicons-power' : 'i-heroicons-power'"
            :color="isPoweredOn ? 'success' : 'neutral'"
            variant="soft"
            @click="handlePowerToggle"
            :loading="isPowerLoading"
            :disabled="!isDeviceOnline"
            :title="isPoweredOn ? 'LEDs ausschalten' : 'LEDs einschalten'"
          />
          
          <!-- Device Status & Setup -->
          <UButton
            :icon="deviceStatus.icon"
            :color="deviceStatus.color"
            variant="soft"
            @click="emit('open-device-setup')"
            :title="selectedDevice ? 'Gerät verwalten' : 'ESP8266 einrichten'"
          >
            <span class="hidden sm:inline">{{ deviceStatus.text }}</span>
          </UButton>
          
          <!-- API Key Setup -->
          <UButton
            icon="i-heroicons-key"
            color="neutral"
            variant="soft"
            @click="emit('open-api-key-modal')"
            title="API Key konfigurieren"
          >
            <span class="hidden sm:inline">API Key</span>
          </UButton>
        </div>
      </div>
    </div>
  </div>
</template>
