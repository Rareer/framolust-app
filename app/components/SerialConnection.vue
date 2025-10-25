<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'

const { 
  isConnected, 
  isSupported, 
  error, 
  requestPort, 
  connect, 
  disconnect,
  autoConnect,
  checkSupport
} = useSerialPort()

const isConnecting = ref(false)
const showUnsupportedWarning = ref(false)

onMounted(() => {
  checkSupport()
  
  if (!isSupported.value) {
    showUnsupportedWarning.value = true
    return
  }
  
  // Try to auto-connect to previously authorized device
  autoConnect().catch(() => {
    // Silently fail if no device was previously authorized
  })
})

const handleConnect = async () => {
  if (!isSupported.value) {
    showUnsupportedWarning.value = true
    return
  }

  isConnecting.value = true
  
  try {
    // Request port selection from user
    const portSelected = await requestPort()
    
    if (portSelected) {
      // Connect to the selected port
      await connect(115200)
    }
  } finally {
    isConnecting.value = false
  }
}

const handleDisconnect = async () => {
  await disconnect()
}
</script>

<template>
  <div>
    <!-- Connection Button -->
    <UButton
      v-if="!isConnected"
      icon="i-heroicons-bolt"
      :label="isConnecting ? 'Verbinde...' : 'ESP8266 verbinden'"
      color="primary"
      variant="soft"
      size="lg"
      :loading="isConnecting"
      @click="handleConnect"
      title="ESP8266 über USB verbinden"
    />
    
    <!-- Connected Status -->
    <div v-else class="flex items-center gap-3">
      <div class="flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-lg">
        <div class="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
        <span class="text-sm font-medium text-green-400">ESP8266 verbunden</span>
      </div>
      <UButton
        icon="i-heroicons-x-mark"
        color="error"
        variant="soft"
        size="lg"
        @click="handleDisconnect"
        title="Verbindung trennen"
      />
    </div>

    <!-- Error Alert with Help -->
    <div v-if="error" class="mt-4 space-y-3">
      <UAlert
        icon="i-heroicons-exclamation-triangle"
        color="error"
        variant="subtle"
        :title="error"
      />
      
      <!-- Help for common error -->
      <div v-if="error.includes('bereits in Verwendung')" class="bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-4">
        <div class="flex gap-3">
          <UIcon name="i-heroicons-light-bulb" class="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
          <div class="space-y-2 text-sm">
            <p class="font-medium text-yellow-300">Lösungsvorschläge:</p>
            <ul class="text-gray-400 space-y-1 list-disc list-inside">
              <li>Schließe die Arduino IDE (Serial Monitor)</li>
              <li>Schließe andere Serial-Programme (PuTTY, etc.)</li>
              <li>Trenne das USB-Kabel kurz und verbinde es neu</li>
              <li>Starte den Browser neu</li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <!-- Unsupported Browser Warning -->
    <UAlert
      v-if="showUnsupportedWarning"
      icon="i-heroicons-exclamation-circle"
      color="warning"
      variant="subtle"
      title="Browser nicht unterstützt"
      description="Dein Browser unterstützt die Web Serial API nicht. Bitte verwende Chrome, Edge oder Opera."
      class="mt-4"
    />
  </div>
</template>
