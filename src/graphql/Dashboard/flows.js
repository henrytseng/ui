import gql from 'graphql-tag'

export default function(isCloud) {
  return gql`
    query Flows(
      $archived: Boolean
      $projectId: uuid
      $limit: Int
      $offset: Int
      $orderBy: [flow_order_by!]
      $searchParams: [flow_bool_exp!]
    ) {
      flows: flow(
        where: {
          project_id: { _eq: $projectId }
          archived: { _eq: $archived }
          _or: $searchParams
        }
        limit: $limit
        offset: $offset
        order_by: $orderBy
      ) {
        id
        name

        ${
          isCloud
            ? `
            created_by {
              username
            }`
            : ''
        }

        flow_group_id
        version
        archived
        schedule

        flow_runs(
          where: { state: { _neq: "Scheduled" } }
          order_by: { scheduled_start_time: desc }
          limit: 10
        ) {
          id
          name
          state
          start_time
          scheduled_start_time
          end_time
          duration
        }
      }
    }
`
}
