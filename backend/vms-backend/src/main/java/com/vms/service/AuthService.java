package com.vms.service;

import com.vms.dto.LoginRequest;
import com.vms.dto.RegisterRequest;
import com.vms.entity.Owner;
import com.vms.exception.EmailAlreadyExistsException;
import com.vms.exception.InvalidCredentialsException;
import com.vms.repository.OwnerRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import java.time.LocalDateTime;

@Service
@Slf4j
public class AuthService {

    @Autowired
    private OwnerRepository ownerRepository;

    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    public void register(RegisterRequest request){
        log.info("Owner registration  started for email: {}",request.getEmail());
        if(ownerRepository.existsByEmail(request.getEmail())){
            log.warn("Registration failed. Email already exist: {}",request.getEmail());
            throw new EmailAlreadyExistsException("Email already registered...");
        }
        Owner owner = new Owner();
        owner.setName(request.getName());
        owner.setEmail(request.getEmail());
        owner.setMobile(request.getMobile());
        owner.setPassword(passwordEncoder.encode(request.getPassword()));
        owner.setStatus("ACTIVE");
        LocalDateTime now = LocalDateTime.now();
        owner.setCreatedAt(now);
        owner.setUpdatedAt(now);
        ownerRepository.save(owner);
        log.info("Owner registered successfully. Owner ID:{}",owner.getId());
    }

    public Owner login(LoginRequest request){
        log.info("owner login attempt for email: {}",request.getEmail());
        Owner owner = ownerRepository.findByEmail(request.getEmail()).orElseThrow(()-> {
            log.warn("Long failed Invalid email {} ", request.getEmail());
            return new InvalidCredentialsException("invalid email and password");
        });
        if(!passwordEncoder.matches(request.getPassword(),owner.getPassword())){
            log.warn("Login failed. Invalid password for email: {}",request.getEmail());
            throw  new InvalidCredentialsException("invalid email and password");
        }
        log.info("Owner login successfully. Owner Id: {}",owner.getId());
        return owner;
    }
}