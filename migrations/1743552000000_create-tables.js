/**
 * @type {import('node-pg-migrate').MigrationBuilder}
 */
exports.up = (pgm) => {
  pgm.createTable('users', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    username: { type: 'varchar(255)', notNull: true, unique: true },
    password_hash: { type: 'text', notNull: true },
    created_at: { type: 'timestamptz', notNull: true },
  });

  pgm.createTable('conversations', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    created_at: { type: 'timestamptz', notNull: true },
  });

  pgm.createTable('conversation_members', {
    conversation_id: {
      type: 'uuid',
      notNull: true,
      references: 'conversations(id)',
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users(id)',
    },
  });
  pgm.addConstraint('conversation_members', 'conversation_members_pkey', 'PRIMARY KEY (conversation_id, user_id)');

  pgm.createTable('messages', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    conversation_id: {
      type: 'uuid',
      notNull: true,
      references: 'conversations(id)',
    },
    from_user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users(id)',
    },
    body: { type: 'text', notNull: true },
    seq: { type: 'bigint', notNull: true },
    created_at: { type: 'timestamptz', notNull: true },
  });

  pgm.createIndex('messages', ['conversation_id', 'seq']);
};

exports.down = (pgm) => {
  pgm.dropTable('messages');
  pgm.dropTable('conversation_members');
  pgm.dropTable('conversations');
  pgm.dropTable('users');
};