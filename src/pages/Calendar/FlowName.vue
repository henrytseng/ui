<script>
export default {
  props: {
    id: {
      type: String,
      required: true
    },
    left: {
      type: Boolean
    },
    active: {
      type: Boolean,
      required: false,
      default: false
    },
    fgIds: {
      type: Array,
      required: false,
      default: () => []
    },
    truncate: {
      type: Boolean,
      required: false,
      default: true
    },
    name: {
      type: String,
      required: false,
      default: null
    },
    version: {
      type: String,
      required: false,
      default: null
    },
    fgId: {
      type: String,
      required: false,
      default: null
    }
  },
  data() {
    return {
      loadingKey: 0
    }
  },
  computed: {
    flowDetails() {
      const version =
        this.fgIds.filter(id => id === this.fgId).length > 1
          ? `(Version ${this.version})`
          : ''
      const active = this.active ? '' : '- no current runs'
      return `${this.name} ${version} ${active}`
    },
    flowNameText() {
      const version =
        this.fgIds.filter(id => id === this.fgId).length > 1
          ? `(Version ${this.version})`
          : ''
      const name = this.name ? `${this.name}` : `${this.flow?.name}`
      return `${name} ${version}`
    },
    textAlign() {
      if (this.left) return 'text-left'
      return 'text-center'
    }
  },
  watch: {
    flow(val) {
      if (val && this.active) this.$emit('fg', val.flow_group_id)
    }
  },
  methods: {
    addDot(state) {
      if (this.active) {
        return {
          'border-radius': '50%',
          display: 'inline-block',
          'background-color': `var(--v-${state}-base)`,
          height: '5px',
          width: '5px',
          'margin-right': '3px'
        }
      } else {
        return {
          'margin-right': '8px'
        }
      }
    }
  },
  apollo: {
    flow: {
      query: require('@/graphql/Flow/flow-by-pk.gql'),
      variables() {
        return {
          flowId: this.id
        }
      },
      skip() {
        return this.name
      },
      loadingKey: 'loadingKey',
      pollInterval: 500000,
      update: data => data.flow_by_pk
    }
  }
}
</script>

<template>
  <span v-if="loadingKey < 1" class="caption max-width" :class="[textAlign]">
    <truncate v-if="truncate" :content="flowDetails">
      <span :style="addDot('primary')"></span>
      {{ flowNameText }}
    </truncate>
    <span v-else> {{ flowNameText }} </span>
  </span>
</template>

<style lang="scss" scoped>
div >>> div {
  background-color: #f9f9f9;
}
</style>
