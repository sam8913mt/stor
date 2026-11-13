import { lazy, Suspense } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { AppProviders } from './context';
import { Layout } from './components/Layout';
import { LoginGate, RequireAuth } from './components/Guards';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Loading } from './components/ui';
import Home from './pages/Home';

// Everything except the home page is code-split, so first load stays small and the admin never reaches shoppers.
const Shop = lazy(() => import('./pages/Shop'));
const Collections = lazy(() => import('./pages/Collections'));
const Product = lazy(() => import('./pages/Product'));
const Cart = lazy(() => import('./pages/Cart'));
const Checkout = lazy(() => import('./pages/Checkout'));
const OrderSuccess = lazy(() => import('./pages/OrderSuccess'));
const Wishlist = lazy(() => import('./pages/Wishlist'));
const Auth = lazy(() => import('./pages/Auth'));
const Account = lazy(() => import('./pages/Account'));
const CmsPage = lazy(() => import('./pages/CmsPage'));
const NotFound = lazy(() => import('./pages/NotFound'));
const Admin = lazy(() => import('./admin/routes'));

export default function App() {
  return (
    <ErrorBoundary>
      <HashRouter>
        <AppProviders>
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route path="/admin/*" element={<Admin />} />
              <Route element={<Layout />}>
                <Route index element={<Home />} />
                <Route path="shop" element={<Shop />} />
                <Route path="collections" element={<Collections />} />
                <Route path="collections/:slug" element={<Shop pinned />} />
                <Route path="product/:slug" element={<Product />} />
                <Route path="cart" element={<LoginGate kind="cart"><Cart /></LoginGate>} />
                <Route path="checkout" element={<RequireAuth><Checkout /></RequireAuth>} />
                <Route path="order-success/:number" element={<RequireAuth><OrderSuccess /></RequireAuth>} />
                <Route path="wishlist" element={<LoginGate kind="wishlist"><Wishlist /></LoginGate>} />
                <Route path="login" element={<Auth />} />
                <Route path="account/*" element={<LoginGate kind="account"><Account /></LoginGate>} />
                <Route path="p/:slug" element={<CmsPage />} />
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </Suspense>
        </AppProviders>
      </HashRouter>
    </ErrorBoundary>
  );
}
