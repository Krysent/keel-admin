/**
 * User Management page — complete CRUD example.
 *
 * Demonstrates the full pattern a business developer should follow:
 *   - Search form (keyword + status filter)
 *   - KeelTable with permission-filtered columns, pagination, column settings
 *   - Create / Edit / Delete buttons gated by `<Auth code=... />`
 *   - `useTable` hook with stale-while-revalidate caching
 *
 * This page is the canonical reference for new CRUD modules in the admin app.
 *
 * Validates: Requirements 4.4, 10.1, 10.2, 19.3, 20.1, 20.2, 20.3
 */

import { useCallback, useState } from 'react';
import {
  App as AntApp,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
} from 'antd';
import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { UserInfo } from '@keel/types';
import { filterColumnsByPermission, type KeelColumn } from '@keel/ui';

import { PERMISSIONS } from '../../../config/permissions.js';
import { Auth } from '../../../components/Auth.js';
import { useTable, type TableFetchParams } from '../../../hooks/useTable.js';
import { useUserStore } from '../../../stores/user.store.js';
import {
  userService,
  type UserListQuery,
  type CreateUserParams,
  type UpdateUserParams,
} from '../../../services/index.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UserFormValues {
  username: string;
  displayName: string;
  email?: string;
  password?: string;
  roles?: string[];
}

type UserTableColumn = ColumnsType<UserInfo>[number] & KeelColumn;

// ---------------------------------------------------------------------------
// Column Definitions
// ---------------------------------------------------------------------------

function useColumns(opts: {
  onEdit: (record: UserInfo) => void;
  onDelete: (id: string) => void;
}): UserTableColumn[] {
  return [
    {
      title: 'Username',
      dataIndex: 'username',
      key: 'username',
      width: 140,
    },
    {
      title: 'Display Name',
      dataIndex: 'displayName',
      key: 'displayName',
      width: 160,
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      width: 200,
      // This column requires user:list permission (demonstration of Req 10.2)
      permission: PERMISSIONS.USER.LIST,
    },
    {
      title: 'Roles',
      dataIndex: 'roles',
      key: 'roles',
      width: 200,
      render: (_: unknown, record: UserInfo) => (
        <Space size={4} wrap>
          {record.roles.map((role) => (
            <Tag key={role} color="blue">
              {role}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 160,
      fixed: 'right' as const,
      render: (_: unknown, record: UserInfo) => (
        <Space size={8}>
          <Auth code={PERMISSIONS.USER.UPDATE}>
            <Tooltip title="Edit">
              <Button
                type="link"
                size="small"
                icon={<EditOutlined />}
                onClick={() => opts.onEdit(record)}
              />
            </Tooltip>
          </Auth>
          <Auth code={PERMISSIONS.USER.DELETE}>
            <Popconfirm
              title="Delete user"
              description={`Are you sure you want to delete "${record.displayName}"?`}
              onConfirm={() => opts.onDelete(record.id)}
              okText="Delete"
              cancelText="Cancel"
              okButtonProps={{ danger: true }}
            >
              <Tooltip title="Delete">
                <Button
                  type="link"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                />
              </Tooltip>
            </Popconfirm>
          </Auth>
        </Space>
      ),
    },
  ];
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function UserManagementPage(): JSX.Element {
  const { message } = AntApp.useApp();
  const [searchForm] = Form.useForm();

  // Permission context for column filtering (Req 10.2)
  const permissions = useUserStore((s) => s.permissions);
  const roles = useUserStore((s) => s.roles);
  const permCtx = { permissions, roles };

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingUser, setEditingUser] = useState<UserInfo | null>(null);
  const [modalForm] = Form.useForm<UserFormValues>();
  const [submitting, setSubmitting] = useState(false);

  // useTable hook with SWR caching (Req 19.3)
  const table = useTable<UserInfo, UserListQuery & TableFetchParams>({
    fetchFn: userService.list,
    cacheKey: 'user-management',
    defaultPageSize: 10,
  });

  // ------ Handlers ------

  const handleSearch = useCallback(() => {
    const values = searchForm.getFieldsValue();
    table.search(values);
  }, [searchForm, table]);

  const handleReset = useCallback(() => {
    searchForm.resetFields();
    table.reset();
  }, [searchForm, table]);

  const handleCreate = useCallback(() => {
    setModalMode('create');
    setEditingUser(null);
    modalForm.resetFields();
    setModalOpen(true);
  }, [modalForm]);

  const handleEdit = useCallback(
    (record: UserInfo) => {
      setModalMode('edit');
      setEditingUser(record);
      const formValues: UserFormValues = {
        username: record.username,
        displayName: record.displayName,
      };
      if (record.email) formValues.email = record.email;
      if (record.roles.length > 0) formValues.roles = record.roles;
      modalForm.setFieldsValue(formValues);
      setModalOpen(true);
    },
    [modalForm],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await userService.remove(id);
        message.success('User deleted successfully');
        table.refresh();
      } catch {
        message.error('Failed to delete user');
      }
    },
    [message, table],
  );

  const handleModalOk = useCallback(async () => {
    try {
      const values = await modalForm.validateFields();
      setSubmitting(true);

      if (modalMode === 'create') {
        await userService.create(values as CreateUserParams);
        message.success('User created successfully');
      } else if (editingUser) {
        const updateData: UpdateUserParams = {};
        if (values.displayName) updateData.displayName = values.displayName;
        if (values.email) updateData.email = values.email;
        if (values.roles && values.roles.length > 0) updateData.roles = values.roles;
        await userService.update(editingUser.id, updateData);
        message.success('User updated successfully');
      }

      setModalOpen(false);
      table.refresh();
    } catch {
      // Validation errors are surfaced by AntD form, network errors
      // would be caught by the global error handler.
    } finally {
      setSubmitting(false);
    }
  }, [modalForm, modalMode, editingUser, message, table]);

  const handleModalCancel = useCallback(() => {
    setModalOpen(false);
  }, []);

  // ------ Columns with permission filtering (Req 10.2) ------

  const rawColumns = useColumns({ onEdit: handleEdit, onDelete: handleDelete });
  const visibleColumns = filterColumnsByPermission(
    rawColumns,
    permCtx,
  ) as ColumnsType<UserInfo>;

  // ------ Render ------

  return (
    <div style={{ padding: 24 }}>
      {/* Search Form */}
      <Card style={{ marginBottom: 16 }}>
        <Form
          form={searchForm}
          layout="inline"
          style={{ gap: 12, flexWrap: 'wrap' }}
        >
          <Form.Item name="keyword" style={{ minWidth: 200 }}>
            <Input placeholder="Search by username or name" allowClear />
          </Form.Item>
          <Form.Item name="status" style={{ minWidth: 140 }}>
            <Select
              placeholder="Status"
              allowClear
              options={[
                { label: 'Active', value: 'active' },
                { label: 'Disabled', value: 'disabled' },
              ]}
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button
                type="primary"
                icon={<SearchOutlined />}
                onClick={handleSearch}
              >
                Search
              </Button>
              <Button onClick={handleReset}>Reset</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      {/* Table with toolbar */}
      <Card>
        {/* Toolbar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: 16,
          }}
        >
          <Auth code={PERMISSIONS.USER.CREATE}>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
              New User
            </Button>
          </Auth>
          <Space>
            <Tooltip title="Refresh">
              <Button
                icon={<ReloadOutlined spin={table.refreshing} />}
                onClick={table.refresh}
              />
            </Tooltip>
          </Space>
        </div>

        {/* KeelTable — uses AntD Table + column permission filter */}
        <Table<UserInfo>
          rowKey="id"
          columns={visibleColumns}
          dataSource={table.data}
          loading={table.loading}
          scroll={{ x: 900 }}
          pagination={{
            current: table.page,
            pageSize: table.pageSize,
            total: table.total,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} users`,
            onChange: (p, ps) => table.setPagination(p, ps),
          }}
        />
      </Card>

      {/* Create / Edit Modal */}
      <Modal
        title={modalMode === 'create' ? 'Create User' : 'Edit User'}
        open={modalOpen}
        onOk={handleModalOk}
        onCancel={handleModalCancel}
        confirmLoading={submitting}
        destroyOnClose
      >
        <Form
          form={modalForm}
          layout="vertical"
          style={{ marginTop: 16 }}
        >
          <Form.Item
            name="username"
            label="Username"
            rules={[{ required: true, message: 'Username is required' }]}
          >
            <Input
              disabled={modalMode === 'edit'}
              placeholder="Enter username"
            />
          </Form.Item>
          <Form.Item
            name="displayName"
            label="Display Name"
            rules={[{ required: true, message: 'Display name is required' }]}
          >
            <Input placeholder="Enter display name" />
          </Form.Item>
          <Form.Item
            name="email"
            label="Email"
            rules={[{ type: 'email', message: 'Please enter a valid email' }]}
          >
            <Input placeholder="Enter email" />
          </Form.Item>
          {modalMode === 'create' && (
            <Form.Item
              name="password"
              label="Password"
              rules={[{ required: true, message: 'Password is required' }]}
            >
              <Input.Password placeholder="Enter password" />
            </Form.Item>
          )}
          <Form.Item name="roles" label="Roles">
            <Select
              mode="multiple"
              placeholder="Select roles"
              options={[
                { label: 'Admin', value: 'admin' },
                { label: 'Editor', value: 'editor' },
                { label: 'Viewer', value: 'viewer' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
