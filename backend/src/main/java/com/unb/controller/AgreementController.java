package com.unb.controller;

import com.unb.dto.*;
import com.unb.service.AgreementService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/agreements")
public class AgreementController {

    private final AgreementService agreementService;
    private final SimpMessagingTemplate messagingTemplate;

    public AgreementController(AgreementService agreementService,
                               SimpMessagingTemplate messagingTemplate) {
        this.agreementService = agreementService;
        this.messagingTemplate = messagingTemplate;
    }

    @GetMapping
    public ResponseEntity<List<AgreementDto>> getAllAgreements(
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String userName,
            @RequestParam(required = false) String filter) {

        List<AgreementDto> agreements;

        if (userName != null && filter != null) {
            switch (filter) {
                case "pending":
                    agreements = agreementService.getPendingAgreements(userName);
                    break;
                case "upcoming":
                    agreements = agreementService.getUpcomingAgreements(userName);
                    break;
                default:
                    agreements = agreementService.getUserAgreements(userName);
            }
        } else if (category != null) {
            agreements = agreementService.getAgreementsByCategory(category);
        } else if (userName != null) {
            agreements = agreementService.getUserAgreements(userName);
        } else {
            agreements = agreementService.getAllAgreements();
        }

        return ResponseEntity.ok(agreements);
    }

    @GetMapping("/{id}")
    public ResponseEntity<AgreementDto> getAgreement(@PathVariable UUID id) {
        try {
            AgreementDto agreement = agreementService.getAgreementById(id);
            return ResponseEntity.ok(agreement);
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping
    public ResponseEntity<AgreementDto> createAgreement(@Valid @RequestBody CreateAgreementRequest request) {
        AgreementDto agreement = agreementService.createAgreement(request);
        broadcastAgreementChange();
        return ResponseEntity.status(HttpStatus.CREATED).body(agreement);
    }

    @PatchMapping("/{id}/participants")
    public ResponseEntity<AgreementDto> updateParticipantStatus(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateParticipantStatusRequest request) {
        try {
            AgreementDto agreement = agreementService.updateParticipantStatus(id, request);
            broadcastAgreementChange();
            return ResponseEntity.ok(agreement);
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/stats")
    public ResponseEntity<StatsDto> getStats(@RequestParam String userName) {
        StatsDto stats = agreementService.getStats(userName);
        return ResponseEntity.ok(stats);
    }

    @PostMapping("/{id}/participants/add")
    public ResponseEntity<?> addParticipant(
            @PathVariable UUID id,
            @Valid @RequestBody AddParticipantRequest request) {
        try {
            AgreementDto agreement = agreementService.addParticipant(id, request);
            broadcastAgreementChange();
            return ResponseEntity.ok(agreement);
        } catch (RuntimeException e) {
            if (e.getMessage() != null && e.getMessage().contains("생성자만")) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(java.util.Map.of("error", e.getMessage()));
            }
            return ResponseEntity.badRequest().body(java.util.Map.of("error", e.getMessage()));
        }
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<?> updateAgreementStatus(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateAgreementStatusRequest request) {
        try {
            AgreementDto agreement = agreementService.updateAgreementStatus(id, request.getRequesterId(), request.getStatus());
            broadcastAgreementChange();
            return ResponseEntity.ok(agreement);
        } catch (RuntimeException e) {
            if (e.getMessage() != null && e.getMessage().contains("생성자만")) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(java.util.Map.of("error", e.getMessage()));
            }
            return ResponseEntity.badRequest().body(java.util.Map.of("error", e.getMessage()));
        }
    }

    @PatchMapping("/{id}/content")
    public ResponseEntity<?> updateAgreementContent(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateAgreementContentRequest request) {
        try {
            AgreementDto agreement = agreementService.updateAgreementContent(id, request);
            broadcastAgreementChange();
            return ResponseEntity.ok(agreement);
        } catch (RuntimeException e) {
            if (e.getMessage() != null && e.getMessage().contains("생성자만")) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(java.util.Map.of("error", e.getMessage()));
            }
            return ResponseEntity.badRequest().body(java.util.Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/{id}/timeline")
    public ResponseEntity<List<AgreementEventDto>> getAgreementTimeline(@PathVariable UUID id) {
        try {
            List<AgreementEventDto> events = agreementService.getAgreementTimeline(id);
            return ResponseEntity.ok(events);
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    private void broadcastAgreementChange() {
        messagingTemplate.convertAndSend(
            "/topic/app-events",
            Map.of("type", "AGREEMENTS", "occurredAt", Instant.now().toString())
        );
    }
}
