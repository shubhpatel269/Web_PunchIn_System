import { Routes } from '@angular/router';
import { Home } from './features/home/home';
import { PunchIn } from './features/punch-in/punch-in';
import { UserRegister } from './features/user-register/user-register';
import { Login } from './features/login/login';
import { AdminDashboard } from './features/admin-dashboard/admin-dashboard';
import { ManageUser } from './features/manage-user/manage-user';

export const routes: Routes = [
    {path:'home',component:Home},
    {path:'login',component:Login},
    {path:'punchin',component:PunchIn},
    {path:'register-user',component:UserRegister},
    {path:'admin',component:AdminDashboard, children: [
        { path: 'manage-user', component: UserRegister },
        { path: 'add-user', loadComponent: () => import('./features/user-register/user-register').then(m => m.UserRegister) },
        { path: 'reports', loadComponent: () => import('./features/reports/reports').then(m => m.Reports) },
        { path: 'profile', loadComponent: () => import('./features/profile/profile').then(m => m.Profile) },
        { path: '', redirectTo: 'manage-user', pathMatch: 'full' }
    ]},
    {path:'**',redirectTo:'login'}
];
