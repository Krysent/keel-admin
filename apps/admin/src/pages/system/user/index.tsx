/**
 * User Management page — ProTable-based CRUD example.
 *
 * Refactored from the legacy KeelTable + useTable implementation to use
 * `ProTable<UserInfo>` directly. Data loading is driven by the `request`
 * prop (no useTable hook). The toolbar options (setting, reload, density,
 * fullScreen) are hard-wired and cannot be disabled by business code.
 *
 * Demonstrates:
 *   - ProTable with `request` prop driving pagination + search
 *   - Column permission filtering via filterColumnsByPermission
 *   - Create Modal via ProForm (ModalForm) with BizError Alert handling
 *   - Edit Modal via ProForm inside an AntD Modal
 *   - Delete via Popconfirm
 *   - All action buttons gated by `<Auth code=... />`
 *
 * Validates: Requirements 23.1, 23.2, 23.3, 23.4, 23.5, 23.7, 23.8, 23.10, 23.13, 23.14
 */

import { useRef, useState, useCallback } from 'react';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import {
  Alert,
  App as AntApp,
  Button,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Tag,
  Tooltip,
} from 'antd';
import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { UserInfo } from '@keel/types';
import { filterColumnsByPermission, type KeelColumn } from '@keel/ui';

import { BizError, isBizError } from '@keel/http';

import { PERMISSIONS } from '../../../config/permissions';
import { Auth } from '../../../components/Auth';
import { useUserStore } from '../../../stores/user.store';
import { useAppStore } from '../../../stores/app.store';
import {
  userService,
  type UserListQuery,
  type CreateUserParams,
  type UpdateUserParams,
} from '../../../services/index';

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

// Search params passed by ProTable to the `request` callback
interface UserSearchParams {
  current?: number;
  pageSize?: number;
  keyword?: string;
  status?: 'active' | 'disabled' | undefined;
}

/**
 * Detect a "username already exists" BizError.
 *
 * The mock (and real) backend returns code 40900 or a message that
 * mentions the username uniqueness constraint. We also do a best-effort
 * check on the message string for robustness.
 */
function isUsernameDuplicateError(err: unknown): err is BizError {
  if (!isBizError(err)) return false;
  // BizError code 40900 is the conventional "conflict / already exists" code
  if (err.code === 40900) return true;
  // Fallback: check for common duplicate-user messages from the backend
  const msg = err.message.toLowerCase();
  return (
    msg.includes('username') &&
    (msg.includes('already exists') ||
      msg.includes('duplicate') ||
      msg.includes('已存在'))
  );
}

// ---------------------------------------------------------------------------
// Column Definitions
// ---------------------------------------------------------------------------

function buildColumns(opts: {
  onEdit: (record: UserInfo) => void;
  onDelete: (record: UserInfo) => void;
  getDeleteConfirmTitle: (displayName: string) => string;
  getDeleteOkText: () => string;
  getDeleteCancelText: () => string;
}): (ProColumns<UserInfo> & KeelColumn)[] {
  return [
    /**
     * Virtual search-only column for keyword (modular match on username /
     * displayName). `hideInTable: true` keeps it out of the data columns
     * while still registering it as a search field (Req 23.3).
     */
    {
      title: 'Keyword',
      dataIndex: 'keyword',
      key: 'keyword',
      valueType: 'text',
      hideInTable: true,
      search: {
        transform: (value: string) => ({ keyword: value || undefined }),
      },
      fieldProps: {
        placeholder: 'Search by username / display name',
        allowClear: true,
      },
    },
    /**
     * Virtual search-only column for status filter (Req 23.3).
     * `hideInTable: true` keeps it out of the data columns.
     */
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      valueType: 'select',
      hideInTable: true,
      valueEnum: {
        active: { text: 'Active', status: 'Success' },
        disabled: { text: 'Disabled', status: 'Error' },
      },
      search: {
        transform: (value: string) => ({ status: value || undefined }),
      },
      fieldProps: {
        allowClear: true,
        placeholder: 'All statuses',
      },
    },
    {
      title: 'Username',
      dataIndex: 'username',
      key: 'username',
      width: 140,
      search: false,
    },
    {
      title: 'Display Name',
      dataIndex: 'displayName',
      key: 'displayName',
      width: 160,
      search: false,
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      width: 200,
      search: false,
      // Requires user:list permission — Req 23.10 / 10.2
      permission: PERMISSIONS.USER.LIST,
    },
    {
      title: 'Roles',
      dataIndex: 'roles',
      key: 'roles',
      width: 200,
      search: false,
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
      fixed: 'right',
      search: false,
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
              title={opts.getDeleteConfirmTitle(record.displayName)}
              onConfirm={() => opts.onDelete(record)}
              okText={opts.getDeleteOkText()}
              cancelText={opts.getDeleteCancelText()}
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
  const { t, i18n } = useTranslation();

  // ProTable action ref for programmatic reload
  const actionRef = useRef<ActionType>(null);

  // Permission context for column filtering (Req 10.2 / 23.10)
  const permissions = useUserStore((s) => s.permissions);
  const roles = useUserStore((s) => s.roles);
  const permCtx = { permissions, roles };

  // Current locale for i18n-aware showTotal (Req 23.4)
  const locale = useAppStore((s) => s.locale);

  // ------ Create Modal state ------
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createForm] = Form.useForm<UserFormValues>();
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSubmitting, setCreateSubmitting] = useState(false);

  // ------ Edit Modal state ------
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserInfo | null>(null);
  const [editForm] = Form.useForm<UserFormValues>();
  const [editError, setEditError] = useState<string | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);

  // ------ Helpers ------

  /**
   * Resolve locale-aware success message.
   * zh-CN → "操作成功", en-US → "Success"
   */
  const getSuccessMessage = useCallback((): string => {
    const isZh = (i18n.language || locale).startsWith('zh');
    return isZh
      ? t('common.operationSuccess', { defaultValue: '操作成功' })
      : t('common.success', { defaultValue: 'Success' });
  }, [t, i18n.language, locale]);

  /**
   * Resolve error message from a caught error.
   * Falls back to `common.error.unknown` i18n key.
   */
  const getErrorMessage = useCallback(
    (err: unknown): string => {
      const fallback = t('common.error.unknown', {
        defaultValue: 'An unknown error occurred',
      });
      if (err instanceof BizError) return err.message;
      if (err instanceof Error && err.message) return err.message;
      return fallback;
    },
    [t],
  );

  // ------ Handlers ------

  const handleCreate = useCallback(() => {
    setCreateError(null);
    createForm.resetFields();
    setCreateModalOpen(true);
  }, [createForm]);

  const handleCreateSubmit = useCallback(async () => {
    try {
      const values = await createForm.validateFields();
      setCreateSubmitting(true);
      setCreateError(null);

      await userService.create(values as CreateUserParams);
      setCreateModalOpen(false);
      actionRef.current?.reload();
      message.success(getSuccessMessage());
    } catch (err) {
      // AntD validation errors have no .code — skip those
      if (err instanceof Error && (err as { errorFields?: unknown }).errorFields) {
        // AntD form validation error — do not close modal, no alert needed
        return;
      }
      // Username duplicate: set field-level error
      if (isUsernameDuplicateError(err)) {
        createForm.setFields([
          {
            name: 'username',
            errors: ['用户名已存在'],
          },
        ]);
        return;
      }
      // Other API error: show Alert at top of form, keep modal open
      setCreateError(getErrorMessage(err));
    } finally {
      setCreateSubmitting(false);
    }
  }, [createForm, message, getSuccessMessage, getErrorMessage]);

  const handleCreateCancel = useCallback(() => {
    setCreateModalOpen(false);
    setCreateError(null);
  }, []);

  const handleEdit = useCallback(
    (record: UserInfo) => {
      setEditError(null);
      setEditingUser(record);
      const formValues: UserFormValues = {
        username: record.username,
        displayName: record.displayName,
      };
      if (record.email) formValues.email = record.email;
      if (record.roles.length > 0) formValues.roles = record.roles;
      editForm.setFieldsValue(formValues);
      setEditModalOpen(true);
    },
    [editForm],
  );

  const handleEditSubmit = useCallback(async () => {
    if (!editingUser) return;
    try {
      const values = await editForm.validateFields();
      setEditSubmitting(true);
      setEditError(null);

      const updateData: UpdateUserParams = {};
      if (values.displayName) updateData.displayName = values.displayName;
      if (values.email !== undefined) updateData.email = values.email;
      if (values.roles && values.roles.length > 0) updateData.roles = values.roles;

      await userService.update(editingUser.id, updateData);
      setEditModalOpen(false);
      actionRef.current?.reload();
      message.success(getSuccessMessage());
    } catch (err) {
      if (err instanceof Error && (err as { errorFields?: unknown }).errorFields) {
        return;
      }
      setEditError(getErrorMessage(err));
    } finally {
      setEditSubmitting(false);
    }
  }, [editForm, editingUser, message, getSuccessMessage, getErrorMessage]);

  const handleEditCancel = useCallback(() => {
    setEditModalOpen(false);
    setEditError(null);
  }, []);

  const handleDelete = useCallback(
    async (record: UserInfo) => {
      try {
        await userService.remove(record.id);
        message.success(getSuccessMessage());
        actionRef.current?.reload();
      } catch (err) {
        message.error(getErrorMessage(err));
      }
    },
    [message, getSuccessMessage, getErrorMessage],
  );

  // ------ Column filtering (Req 10.2 / 23.10) ------

  const isZhLocale = useCallback(
    () => (i18n.language || locale).startsWith('zh'),
    [i18n.language, locale],
  );

  const getDeleteConfirmTitle = useCallback(
    (displayName: string): string => {
      return isZhLocale()
        ? `确定删除用户 "${displayName}" 吗？`
        : `Are you sure you want to delete "${displayName}"?`;
    },
    [isZhLocale],
  );

  const getDeleteOkText = useCallback(
    (): string => (isZhLocale() ? '删除' : 'Delete'),
    [isZhLocale],
  );

  const getDeleteCancelText = useCallback(
    (): string => (isZhLocale() ? '取消' : 'Cancel'),
    [isZhLocale],
  );

  const rawColumns = buildColumns({
    onEdit: handleEdit,
    onDelete: handleDelete,
    getDeleteConfirmTitle,
    getDeleteOkText,
    getDeleteCancelText,
  });

  const visibleColumns = filterColumnsByPermission(
    rawColumns,
    permCtx,
  ) as ProColumns<UserInfo>[];

  // ------ ProTable request prop (Req 23.13) ------
  // Returns { data, success, total } — the ProTable contract.
  // ProTable passes { current, pageSize, keyword?, status?, ... } as params
  // after applying each column's `search.transform`. Undefined values for
  // keyword/status are not forwarded to the API (Req 23.3, 23.14).

  const request = useCallback(
    async (params: UserSearchParams): Promise<{ data: UserInfo[]; success: boolean; total: number }> => {
      try {
        const { current = 1, pageSize = 10 } = params;
        const query: UserListQuery = {
          page: current,
          pageSize,
        };
        // Only include truthy search values — undefined means "no filter"
        if (params.keyword) query.keyword = params.keyword;
        if (params.status) query.status = params.status;
        const result = await userService.list(query);
        return {
          data: result.list,
          success: true,
          total: result.total,
        };
      } catch {
        return { data: [], success: false, total: 0 };
      }
    },
    [],
  );

  // ------ Render ------

  return (
    <>
      {/* ProTable — Req 23.1, 23.2, 23.3, 23.4, 23.13, 23.14 */}
      <ProTable<UserInfo>
        rowKey="id"
        actionRef={actionRef}
        columns={visibleColumns}
        request={request}
        scroll={{ x: 900 }}
        // Toolbar: setting, reload, density, fullScreen always on (Req 23.2)
        // These four options are forced and CANNOT be disabled by callers.
        options={{
          setting: true,
          reload: true,
          density: true,
          fullScreen: true,
        }}
        // Search form: keyword (text) + status (select) fields are defined
        // via the virtual columns above (hideInTable: true). ProTable
        // auto-generates the form from those column definitions (Req 23.3).
        // defaultCollapsed: false keeps the search form expanded by default.
        search={{
          labelWidth: 'auto',
          filterType: 'light',
          defaultCollapsed: false,
        }}
        // Default pagination — pageSize 10, show total in zh-CN / en-US
        // format (Req 23.4). showTotal renders left of the page controls.
        pagination={{
          defaultPageSize: 10,
          showSizeChanger: true,
          showTotal: (total) =>
            locale === 'zh-CN' ? `共 ${total} 条` : `Total ${total} items`,
        }}
        // Toolbar create button gated by user:create permission (Req 23.9)
        toolBarRender={() => [
          <Auth key="create" code={PERMISSIONS.USER.CREATE}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleCreate}
            >
              New User
            </Button>
          </Auth>,
        ]}
      />

      {/* --------------------------------------------------------------- */}
      {/* Create User Modal — Req 23.5, 23.7                              */}
      {/* --------------------------------------------------------------- */}
      {/*
       * Design decisions:
       *   - Use AntD Modal + Form (not ModalForm from ProForm) so we can
       *     keep full control over the submit flow and show the BizError
       *     Alert *above* the form fields.
       *   - `destroyOnClose` resets the internal form state cleanly.
       *   - `confirmLoading` wires the OK button to our submitting state.
       */}
      <Modal
        title="新建用户 / New User"
        open={createModalOpen}
        onOk={handleCreateSubmit}
        onCancel={handleCreateCancel}
        confirmLoading={createSubmitting}
        destroyOnClose
        afterClose={() => {
          setCreateError(null);
          createForm.resetFields();
        }}
      >
        <Form
          form={createForm}
          layout="vertical"
          style={{ marginTop: 16 }}
        >
          {/* BizError Alert — shown at top of form on submit failure (Req 23.7) */}
          {createError !== null && (
            <Form.Item style={{ marginBottom: 16 }}>
              <Alert
                type="error"
                message={createError}
                showIcon
                closable
                onClose={() => setCreateError(null)}
              />
            </Form.Item>
          )}

          {/* Username — required, maxLength 64 (Req 23.5) */}
          <Form.Item
            name="username"
            label="用户名 / Username"
            rules={[
              { required: true, message: '用户名为必填项 / Username is required' },
              { max: 64, message: '用户名最多 64 个字符 / Max 64 characters' },
            ]}
          >
            <Input
              placeholder="Enter username"
              maxLength={64}
              showCount
            />
          </Form.Item>

          {/* Display Name — required, maxLength 64 (Req 23.5) */}
          <Form.Item
            name="displayName"
            label="显示名 / Display Name"
            rules={[
              { required: true, message: '显示名为必填项 / Display name is required' },
              { max: 64, message: '显示名最多 64 个字符 / Max 64 characters' },
            ]}
          >
            <Input
              placeholder="Enter display name"
              maxLength={64}
              showCount
            />
          </Form.Item>

          {/* Email — optional, email format validation (Req 23.5) */}
          <Form.Item
            name="email"
            label="邮箱 / Email"
            rules={[
              { type: 'email', message: '请输入有效的邮箱地址 / Please enter a valid email address' },
            ]}
          >
            <Input placeholder="Enter email (optional)" />
          </Form.Item>

          {/* Password — required, minLength 6, maxLength 128 (Req 23.5) */}
          <Form.Item
            name="password"
            label="初始密码 / Initial Password"
            rules={[
              { required: true, message: '密码为必填项 / Password is required' },
              { min: 6, message: '密码至少 6 个字符 / Min 6 characters' },
              { max: 128, message: '密码最多 128 个字符 / Max 128 characters' },
            ]}
          >
            <Input.Password
              placeholder="Enter initial password"
              maxLength={128}
            />
          </Form.Item>

          {/* Roles — multi-select, admin / editor / viewer (Req 23.5) */}
          <Form.Item
            name="roles"
            label="角色 / Roles"
          >
            <Select
              mode="multiple"
              placeholder="Select roles (optional)"
              options={[
                { label: 'Admin', value: 'admin' },
                { label: 'Editor', value: 'editor' },
                { label: 'Viewer', value: 'viewer' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* --------------------------------------------------------------- */}
      {/* Edit User Modal — Req 23.6, 23.7                               */}
      {/* --------------------------------------------------------------- */}
      <Modal
        title="编辑用户 / Edit User"
        open={editModalOpen}
        onOk={handleEditSubmit}
        onCancel={handleEditCancel}
        confirmLoading={editSubmitting}
        destroyOnClose
        afterClose={() => {
          setEditError(null);
          editForm.resetFields();
        }}
      >
        <Form
          form={editForm}
          layout="vertical"
          style={{ marginTop: 16 }}
        >
          {/* BizError Alert — Req 23.7 */}
          {editError !== null && (
            <Form.Item style={{ marginBottom: 16 }}>
              <Alert
                type="error"
                message={editError}
                showIcon
                closable
                onClose={() => setEditError(null)}
              />
            </Form.Item>
          )}

          {/* Username — disabled in edit mode (Req 23.6) */}
          <Form.Item
            name="username"
            label="用户名 / Username"
          >
            <Input disabled />
          </Form.Item>

          {/* Display Name — required, maxLength 64 */}
          <Form.Item
            name="displayName"
            label="显示名 / Display Name"
            rules={[
              { required: true, message: '显示名为必填项 / Display name is required' },
              { max: 64, message: '显示名最多 64 个字符 / Max 64 characters' },
            ]}
          >
            <Input
              placeholder="Enter display name"
              maxLength={64}
              showCount
            />
          </Form.Item>

          {/* Email — optional, email format */}
          <Form.Item
            name="email"
            label="邮箱 / Email"
            rules={[
              { type: 'email', message: '请输入有效的邮箱地址 / Please enter a valid email address' },
            ]}
          >
            <Input placeholder="Enter email (optional)" />
          </Form.Item>

          {/* Password field is NOT rendered in edit mode — Req 23.6 */}

          {/* Roles — multi-select */}
          <Form.Item
            name="roles"
            label="角色 / Roles"
          >
            <Select
              mode="multiple"
              placeholder="Select roles (optional)"
              options={[
                { label: 'Admin', value: 'admin' },
                { label: 'Editor', value: 'editor' },
                { label: 'Viewer', value: 'viewer' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
