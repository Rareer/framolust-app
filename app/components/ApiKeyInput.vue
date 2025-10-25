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
  <div class="flex items-center gap-3">
    <UIcon name="i-heroicons-key" class="w-6 h-6 flex-shrink-0 text-indigo-400" />
    <UInput
      v-model="localApiKey"
      :type="showKey ? 'text' : 'password'"
      placeholder="OpenAI API Key (sk-...)"
      size="lg"
      class="flex-1"
      :ui="{ base: 'font-mono text-sm' }"
    />
    <UButton
      :icon="showKey ? 'i-heroicons-eye-slash' : 'i-heroicons-eye'"
      color="neutral"
      variant="soft"
      size="lg"
      @click="showKey = !showKey"
      title="Key anzeigen/verbergen"
    />
    <UButton
      icon="i-heroicons-check"
      color="primary"
      size="lg"
      @click="saveApiKey"
      :disabled="!localApiKey"
      title="Speichern"
    />
    <UButton
      v-if="hasApiKey"
      icon="i-heroicons-trash"
      color="error"
      variant="soft"
      size="lg"
      @click="clearApiKey"
      title="Löschen"
    />
  </div>
</template>
