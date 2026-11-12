import { Route, Routes } from 'react-router-dom';
import { AdminLayout } from './AdminLayout';
import Dashboard from './Dashboard';
import AdminOrders from './Orders';
import { ProductEditor, ProductsList } from './Products';
import { AdminCategories, AdminCollections, AdminCoupons } from './Simple';
import AdminReviews from './Reviews';
import Customers from './Customers';
import AdminCms from './Cms';
import { AdminSettings } from './SettingsForm';
import Admins from './Admins';
import Logs from './Logs';
import AdminPayments from './Payments';
import AdminEmail from './Email';
import AdminSms from './Sms';
import '../styles/admin.css';

export default function AdminRoutes() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="orders" element={<AdminOrders />} />
        <Route path="products" element={<ProductsList />} />
        <Route path="products/:id" element={<ProductEditor />} />
        <Route path="categories" element={<AdminCategories />} />
        <Route path="collections" element={<AdminCollections />} />
        <Route path="coupons" element={<AdminCoupons />} />
        <Route path="reviews" element={<AdminReviews />} />
        <Route path="customers" element={<Customers />} />
        <Route path="cms" element={<AdminCms />} />
        <Route path="settings" element={<AdminSettings />} />
        <Route path="payments" element={<AdminPayments />} />
        <Route path="email" element={<AdminEmail />} />
        <Route path="sms" element={<AdminSms />} />
        <Route path="admins" element={<Admins />} />
        <Route path="logs" element={<Logs />} />
      </Route>
    </Routes>
  );
}
