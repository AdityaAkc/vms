package com.vms.controller;

import com.vms.dto.ApiResponse;
import com.vms.dto.LoginRequest;
import com.vms.dto.RegisterRequest;
import com.vms.service.AuthService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import java.time.LocalDateTime;

@RestController
@RequestMapping("api/auth")
public class AuthController {

    @Autowired
    private AuthService authService;

    @PostMapping("/register")
    public ResponseEntity<ApiResponse<Void>> register(@RequestBody RegisterRequest request){
        authService.register(request);
        ApiResponse<Void> response = new ApiResponse<>(true,"Owner registered successfully",null, LocalDateTime.now());
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<Void>> login(@RequestBody LoginRequest request) {
        authService.login(request);
        ApiResponse<Void> response = new ApiResponse<>(true, "Login successful", null, LocalDateTime.now());
        return ResponseEntity.status(HttpStatus.OK).body(response);
    }
}
