<script lang="ts">
  let { size = 24, strokeWidth = 2 }: { size?: number; strokeWidth?: number } = $props();
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width={strokeWidth}
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  <rect x="7" y="2.5" width="10" height="3" rx="1" />
  <path d="M8 5.5v1.5c-1.8.6-3 2.2-3 4.2V19a2.5 2.5 0 0 0 2.5 2.5h9A2.5 2.5 0 0 0 19 19v-7.8c0-2-1.2-3.6-3-4.2V5.5" />
  <path d="M5 14c2.3-1.2 4.7 1.2 7 0s4.7-1.2 7 0" />
</svg>
