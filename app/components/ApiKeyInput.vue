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
  <div class="flex items-center gap-2">
    <UIcon name="i-heroicons-key" class="w-5 h-5 flex-shrink-0" />
    <UInput
      v-model="localApiKey"
      :type="showKey ? 'text' : 'password'"
      placeholder="OpenAI API Key (sk-...)"
      class="flex-1"
      :ui="{ base: 'font-mono text-sm' }"
    />
    <UButton
      :icon="showKey ? 'i-heroicons-eye-slash' : 'i-heroicons-eye'"
      color="neutral"
      variant="soft"
      @click="showKey = !showKey"
      title="Key anzeigen/verbergen"
    />
    <UButton
      icon="i-heroicons-check"
      color="primary"
      @click="saveApiKey"
      :disabled="!localApiKey"
      title="Speichern"
    />
    <UButton
      v-if="hasApiKey"
      icon="i-heroicons-trash"
      color="error"
      variant="soft"
      @click="clearApiKey"
      title="Löschen"
    />
  </div>
</template>
