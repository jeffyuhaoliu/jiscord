import cassandra from 'cassandra-driver';

const contactPoints = (process.env.SCYLLA_CONTACT_POINTS ?? 'localhost').split(',');
const localDataCenter = process.env.SCYLLA_LOCAL_DC ?? 'datacenter1';
const keyspace = process.env.SCYLLA_KEYSPACE ?? 'jiscord';

export const client = new cassandra.Client({
  contactPoints,
  localDataCenter,
  keyspace,
});

export async function connect(): Promise<void> {
  await client.connect();
}
