import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';


@Injectable({
  providedIn: 'root'
})
export class Employee {
  constructor(private http: HttpClient) { }

  getEmployees() {
    return this.http.get<any[]>('http://localhost:3000/employees');
  }

  registerEmployee(employeeData: any) {
    return this.http.post('http://localhost:3000/employees', employeeData);
  }

  updateEmployee(id: string, employeeData: any) {
    return this.http.put(`http://localhost:3000/employees/${id}`, employeeData);
  }

  deleteEmployee(id: string) {
    return this.http.delete(`http://localhost:3000/employees/${id}`);
  }

}
