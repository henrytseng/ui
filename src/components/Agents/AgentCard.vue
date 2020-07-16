<script>
import { mapGetters } from 'vuex'

import CardTitle from '@/components/Card-Title'
import Label from '@/components/Label'
import moment from '@/utils/moment'

const AGENT_TYPES = [
  { type: 'DockerAgent', icon: '$docker' },
  { type: 'FargateAgent', icon: '$fargate' },
  { type: 'KubernetesAgent', icon: '$kubernetes' },
  { type: 'LocalAgent', icon: 'fas fa-globe' },
  { type: 'NomadAgent', icon: '$nomad' }
]

export default {
  components: {
    CardTitle,
    Label
  },
  filters: {
    formatDateTime(value) {
      if (!value) return 'None'
      return moment(value).format('h:mma z')
    }
  },
  props: {
    agent: {
      type: Object,
      required: true
    },
    labelRenderLimit: {
      type: Number,
      required: false,
      default: 3
    },
    selectedLabels: {
      type: Array,
      required: false,
      default: () => []
    }
  },
  data() {
    return {
      copiedText: {},
      currentDateTime: moment().format(),
      labelMenuOpen: false,
      interval: null,
      isDeleting: false,
      showConfirmDialog: false,
      showLastQuery: true
    }
  },
  computed: {
    ...mapGetters('agent', ['staleThreshold', 'unhealthyThreshold']),
    agentModified() {
      return {
        ...this.agent,
        labels: this.agent.labels.slice().sort((labelA, labelB) => {
          if (labelA.toLowerCase() < labelB.toLowerCase()) {
            return -1
          } else if (labelA.toLowerCase() > labelB.toLowerCase()) {
            return 1
          } else {
            return 0
          }
        })
      }
    },
    name() {
      return this.agent?.name ? this.agent.name : 'Agent'
    },
    secondsSinceLastQuery() {
      return moment(this.currentDateTime).diff(
        moment(this.agent.last_queried),
        'seconds'
      )
    },
    status() {
      if (this.secondsSinceLastQuery < 60 * this.staleThreshold)
        return 'healthy'
      if (this.secondsSinceLastQuery < 60 * this.unhealthyThreshold)
        return 'stale'

      return 'unhealthy'
    },
    statusColor() {
      return (
        {
          healthy: 'success',
          stale: 'warning',
          unhealthy: 'error'
        }[this.status] || 'secondaryGray'
      )
    },
    timer() {
      if (!this.agent?.last_queried) return null
      if (this.secondsSinceLastQuery < 60) {
        return `${
          this.secondsSinceLastQuery < 0 ? 0 : this.secondsSinceLastQuery
        } seconds ago`
      }

      return moment(this.agent.last_queried).fromNow()
    },
    type() {
      return this.agent?.type ? this.agent.type : 'Agent type unknown'
    }
  },
  watch: {
    secondsSinceLastQuery(newVal, oldVal) {
      if (newVal > oldVal || !this.agent?.last_queried) return

      this.showLastQuery = false

      setTimeout(() => {
        this.showLastQuery = true
      }, 150) // should match fade transition duration
    }
  },
  mounted() {
    this.interval = setInterval(() => {
      this.currentDateTime = moment().format()
    }, 1000)
  },
  beforeDestroy() {
    clearInterval(this.interval)
  },
  methods: {
    agentIcon(type) {
      return AGENT_TYPES.find(a => a.type == type)?.icon
    },
    anyLabelsSelected(labels) {
      return labels.reduce((result, label) => this.labelSelected(label), false)
    },
    copyTextToClipboard(text) {
      if (!text) return

      this.copiedText = {}
      this.copiedText[text] = true
      navigator.clipboard.writeText(text)

      setTimeout(() => {
        this.copiedText = {}
        this.copiedText[text] = false
      }, 1000)
    },
    async deleteAgent() {
      try {
        this.showConfirmDialog = false
        this.isDeleting = true
        await this.$apollo.mutate({
          mutation: require('@/graphql/Agent/delete-agent.gql'),
          variables: {
            agentId: this.agent.id
          }
        })
        setTimeout(() => {
          this.isDeleting = false
        }, 10000)
      } catch (error) {
        this.isDeleting = false
        this.$toasted.error(
          'The agent could not be removed from Cloud. Please try again.',
          {
            containerClass: 'toast-typography',
            action: {
              text: 'Close',
              onClick(e, toastObject) {
                toastObject.goAway(0)
              }
            },
            duration: 5000
          }
        )
      }
    },
    labelSelected(label) {
      return this.selectedLabels.includes(label)
    }
  }
}
</script>

<template>
  <v-card
    tile
    :disabled="isDeleting"
    class="agent-card px-2 pb-3"
    :min-height="$vuetify.breakpoint.smAndDown ? null : 260"
  >
    <v-system-bar :color="statusColor" :height="5" absolute> </v-system-bar>

    <CardTitle
      :title="name"
      :subtitle="type"
      :icon="agent.type ? agentIcon(agent.type) : 'fas fa-robot'"
      :icon-color="statusColor"
      icon-class="mb-2"
      class="pt-3 mb-4"
    >
      <template v-if="['stale', 'unhealthy'].includes(status)" slot="action">
        <v-tooltip bottom>
          <template v-slot:activator="{ on }">
            <v-icon class="float-right mr-4" :color="statusColor" v-on="on">
              {{ status === 'stale' ? 'warning' : 'error' }}
            </v-icon>
          </template>
          <span v-if="status === 'stale'">
            This agent has not queried for flows in the last
            {{ staleThreshold === 1 ? 'minute' : `${staleThreshold} minutes` }}
          </span>
          <span v-if="status === 'unhealthy'">
            This agent has not queried for flows in the last
            {{
              unhealthyThreshold === 1
                ? 'minute'
                : `${unhealthyThreshold} minutes`
            }}
          </span>
        </v-tooltip>
      </template>
    </CardTitle>

    <v-btn
      v-if="status !== 'healthy'"
      small
      color="primary"
      text
      class="mx-1 position-absolute"
      :class="{
        'bottom-right-loaded': !isDeleting,
        'bottom-right-loading': isDeleting
      }"
      :loading="isDeleting"
      @click="showConfirmDialog = true"
    >
      Remove
    </v-btn>

    <v-dialog v-model="showConfirmDialog" max-width="480">
      <v-card>
        <v-card-title class="word-break-normal">
          Are you sure you want to stop displaying this agent?
        </v-card-title>

        <v-card-text class="my-4 body-2">
          <strong>
            This action will not stop the agent process if it is still running
            in your infrastructure.</strong
          >
          It will only stop displaying the agent in Cloud.
        </v-card-text>

        <v-card-actions>
          <v-spacer></v-spacer>

          <v-btn text @click="showConfirmDialog = false">
            Cancel
          </v-btn>

          <v-btn color="error lighten-1" text @click="deleteAgent">
            Confirm
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-card-text class="px-3 py-2">
      <div class="overline">
        LAST QUERY
      </div>
      <transition name="fade">
        <div v-if="showLastQuery" class="body-1">
          <span class="font-weight-bold">{{
            agent.last_queried | formatDateTime
          }}</span>
          <span v-if="agent.last_queried">|</span> {{ timer }}
        </div>
      </transition>

      <div class="d-flex justify-space-between  mb-0 mt-6">
        <div style="width: 50%;">
          <div class="caption">
            CORE VERSION
          </div>
          <div class="body-2 truncate">
            {{ agent.core_version || 'Unknown' }}
          </div>
        </div>

        <div style="width: 50%;">
          <div class="caption">
            TOKEN ID
          </div>
          <div class="body-2">
            <v-tooltip top>
              <template v-slot:activator="{ on }">
                <div
                  class="truncate"
                  :class="{
                    pointer: agent.token_id,
                    'bg-gray-transition': copiedText[agent.token_id],
                    'bg-white-transition': !copiedText[agent.token_id]
                  }"
                  v-on="on"
                  @click="copyTextToClipboard(agent.token_id)"
                >
                  <span v-if="$vuetify.breakpoint.smAndUp" v-on="on">
                    {{ agent.token_id || 'Unknown' }}
                  </span>
                </div>
              </template>

              <span>
                <v-icon
                  v-if="agent.token_id"
                  x-small
                  class="mb-2px mr-2"
                  tabindex="0"
                  color="white"
                >
                  {{ copiedText[agent.token_id] ? 'check' : 'file_copy' }}
                </v-icon>
                {{
                  agent.token_id
                    ? 'Click to copy ID'
                    : 'No token ID found; you may have registered the agent with an older version of Prefect Core.'
                }}</span
              >
            </v-tooltip>
          </div>
        </div>
      </div>

      <div class="overline mb-0 mt-6">
        LABELS
      </div>
      <div v-if="agent && agentModified.labels.length > 0">
        <Label
          v-for="label in agentModified.labels.slice(0, labelRenderLimit)"
          :key="label"
          class="mr-1 mt-1"
          :clickable="agent && agentModified.labels.length > 1"
          :outlined="!labelSelected(label)"
          @click="$emit('label-click', $event)"
        >
          {{ label }}
        </Label>
        <v-menu v-model="labelMenuOpen" close-on-content-click offset-y>
          <template v-slot:activator="{ on }">
            <span v-on="on">
              <Label
                v-if="agentModified.labels.length > labelRenderLimit"
                class="mr-1 mt-1"
                :clickable="agent && agentModified.labels.length > 1"
                :outlined="
                  !anyLabelsSelected(
                    agentModified.labels.slice(labelRenderLimit)
                  )
                "
              >
                +{{ agentModified.labels.length - labelRenderLimit }}
              </Label>
            </span>
          </template>
          <v-card max-height="270">
            <v-list dense flat>
              <v-list-item
                v-for="label in agentModified.labels.slice(labelRenderLimit)"
                :key="label"
              >
                <v-list-item-content>
                  <Label
                    :outlined="!labelSelected(label)"
                    :clickable="agent && agentModified.labels.length > 1"
                    @click="$emit('label-click', $event)"
                  >
                    {{ label }}
                  </Label>
                </v-list-item-content>
              </v-list-item>
            </v-list>
          </v-card>
        </v-menu>
      </div>
      <div v-else class="body-1">
        None
      </div>
    </v-card-text>
  </v-card>
</template>

<style lang="scss" scoped>
.bottom-right-loaded {
  bottom: 4px;
  right: -2px;
}

.bottom-right-loading {
  bottom: 12px;
  right: -16px;
}

.pointer {
  cursor: pointer;
}

.fa-robot {
  color: #666;
  float: right;
  font-size: 1.8em;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 150ms;
}

.fade-enter,
.fade-leave-to {
  opacity: 0;
}
</style>