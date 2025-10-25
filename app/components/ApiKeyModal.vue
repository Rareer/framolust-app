<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'

interface Props {
  open: boolean
}

interface Emits {
  (e: 'update:open', value: boolean): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { apiKey, setApiKey, loadApiKey } = useOpenAI()

const localApiKey = ref('')
const showKey = ref(false)

const isOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value)
})

onMounted(() => {
  loadApiKey()
  localApiKey.value = apiKey.value
})

watch(() => props.open, (newValue) => {
  if (newValue) {
    localApiKey.value = apiKey.value
    showKey.value = false
  }
})

const saveApiKey = () => {
  setApiKey(localApiKey.value)
  isOpen.value = false
}

const clearApiKey = () => {
  localApiKey.value = ''
  setApiKey('')
}

const hasApiKey = computed(() => !!apiKey.value)
</script>

<template>
  <UModal 
    v-model:open="isOpen"
    :ui="{
      wrapper: 'bg-gray-900/95 backdrop-blur-xl rounded-2xl shadow-2xl ring-1 ring-gray-800/50 max-w-2xl',
      overlay: 'backdrop-blur-sm'
    }"
  >
  <template #header>
    <div class="flex items-justify-between gap-3 w-full"> 
    <h2 class="text-3xl font-bold bg-gradient-to-r from-indigo-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent">
      OpenAI API Key
    </h2>
    <UButton
      icon="i-heroicons-x-mark"
      color="neutral"
      variant="ghost"
      size="lg"
      @click="isOpen = false"
      title="Schließen"
    />
    </div>
  </template>
    <template #body>
      <div class="p-8 space-y-6 bg-gray-900 rounded-2xl">
        <!-- Status Badge -->
        <div v-if="hasApiKey" class="flex items-center gap-2 px-4 py-3 bg-green-500/10 border border-green-500/20 rounded-lg">
          <UIcon name="i-heroicons-check-circle" class="w-5 h-5 text-green-400" />
          <span class="text-sm font-medium text-green-400">API Key ist konfiguriert</span>
        </div>

        <!-- Input Section -->
        <div class="space-y-3">
          <label class="text-sm font-semibold text-gray-300">
            API Key
          </label>
          <div class="flex gap-3">
            <UInput
              v-model="localApiKey"
              :type="showKey ? 'text' : 'password'"
              placeholder="sk-..."
              size="xl"
              class="flex-1"
              :ui="{ base: 'font-mono text-sm' }"
            />
            <UButton
              :icon="showKey ? 'i-heroicons-eye-slash' : 'i-heroicons-eye'"
              color="neutral"
              variant="soft"
              size="xl"
              @click="showKey = !showKey"
              title="Key anzeigen/verbergen"
            />
          </div>
          <p class="text-xs text-gray-500">
            🔒 Dein API Key wird lokal im Browser gespeichert und nicht an unseren Server gesendet.
          </p>
        </div>

        <!-- Info Alert with Cinema Style -->
        <div class="bg-indigo-500/5 border border-indigo-500/20 rounded-lg p-4">
          <div class="flex gap-3">
            <UIcon name="i-heroicons-information-circle" class="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5" />
            <div class="space-y-1">
              <p class="text-sm font-medium text-indigo-300">Wo finde ich meinen API Key?</p>
              <p class="text-sm text-gray-400">
                Gehe zu <a href="https://platform.openai.com/api-keys" target="_blank" class="text-indigo-400 hover:text-indigo-300 underline">platform.openai.com/api-keys</a> und erstelle einen neuen API Key.
              </p>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex gap-3 justify-end pt-4 border-t border-gray-800/50">
          <UButton
            v-if="hasApiKey"
            label="Löschen"
            icon="i-heroicons-trash"
            color="error"
            variant="soft"
            size="lg"
            @click="clearApiKey"
          />
          <UButton
            label="Abbrechen"
            color="neutral"
            variant="ghost"
            size="lg"
            @click="isOpen = false"
          />
          <UButton
            label="Speichern"
            icon="i-heroicons-check"
            color="primary"
            size="lg"
            @click="saveApiKey"
            :disabled="!localApiKey"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
