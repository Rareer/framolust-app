<script setup lang="ts">
import { ref, onMounted } from 'vue'

const { apiKey, setApiKey, loadApiKey } = useOpenAI()

const localApiKey = ref('')
const showKey = ref(false)
const isEditing = ref(false)

onMounted(() => {
  loadApiKey()
  localApiKey.value = apiKey.value
  if (!apiKey.value) {
    isEditing.value = true
  }
})

const saveApiKey = () => {
  setApiKey(localApiKey.value)
  isEditing.value = false
}

const clearApiKey = () => {
  localApiKey.value = ''
  setApiKey('')
  isEditing.value = true
}

const hasApiKey = computed(() => !!apiKey.value)
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <UIcon name="i-heroicons-key" class="w-5 h-5" />
          <h3 class="text-lg font-semibold">OpenAI API Key</h3>
        </div>
        <UBadge v-if="hasApiKey" color="success" variant="subtle">
          Konfiguriert
        </UBadge>
      </div>
    </template>

    <div class="space-y-4">
      <div v-if="!isEditing && hasApiKey" class="space-y-3">
        <div class="flex items-center gap-2">
          <UIcon name="i-heroicons-check-circle" class="w-5 h-5 text-green-500" />
          <span class="text-sm text-gray-600 dark:text-gray-400">
            API Key ist gespeichert
          </span>
        </div>
        <div class="flex gap-2">
          <UButton
            label="Bearbeiten"
            icon="i-heroicons-pencil"
            color="neutral"
            variant="soft"
            @click="isEditing = true"
          />
          <UButton
            label="Löschen"
            icon="i-heroicons-trash"
            color="error"
            variant="soft"
            @click="clearApiKey"
          />
        </div>
      </div>

      <div v-else class="space-y-3">
        <div class="space-y-2">
          <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
            API Key eingeben
          </label>
          <div class="flex gap-2">
            <UInput
              v-model="localApiKey"
              :type="showKey ? 'text' : 'password'"
              placeholder="sk-..."
              size="lg"
              class="flex-1"
              :ui="{ base: 'font-mono text-sm' }"
            />
            <UButton
              :icon="showKey ? 'i-heroicons-eye-slash' : 'i-heroicons-eye'"
              color="neutral"
              variant="soft"
              @click="showKey = !showKey"
              size="lg"
            />
          </div>
          <p class="text-xs text-gray-500 dark:text-gray-400">
            Dein API Key wird lokal im Browser gespeichert und nicht an unseren Server gesendet.
          </p>
        </div>

        <div class="flex gap-2">
          <UButton
            label="Speichern"
            icon="i-heroicons-check"
            color="primary"
            @click="saveApiKey"
            :disabled="!localApiKey"
          />
          <UButton
            v-if="hasApiKey"
            label="Abbrechen"
            color="neutral"
            variant="ghost"
            @click="() => { isEditing = false; localApiKey = apiKey }"
          />
        </div>

        <UAlert
          icon="i-heroicons-information-circle"
          color="info"
          variant="subtle"
          title="Wo finde ich meinen API Key?"
          description="Gehe zu platform.openai.com/api-keys und erstelle einen neuen API Key."
        />
      </div>
    </div>
  </UCard>
</template>
