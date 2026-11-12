#pragma once
#include <Arduino.h>
#include "security/events.h"
#include "config.h"

/** Small thread-safe ring buffer: sensing task pushes, network task sends. Oldest is dropped when full. */
class EventQueue {
 public:
  EventQueue() : mux_(portMUX_INITIALIZER_UNLOCKED) {}

  void push(const Event& e) {
    portENTER_CRITICAL(&mux_);
    if (count_ == EVENT_QUEUE_SIZE) {  // full: drop the oldest (blueprint: "limited number of events")
      head_ = (head_ + 1) % EVENT_QUEUE_SIZE;
      count_--;
      dropped_++;
    }
    buf_[(head_ + count_) % EVENT_QUEUE_SIZE] = e;
    count_++;
    portEXIT_CRITICAL(&mux_);
  }

  bool peek(Event& out) {
    bool ok = false;
    portENTER_CRITICAL(&mux_);
    if (count_ > 0) {
      out = buf_[head_];
      ok = true;
    }
    portEXIT_CRITICAL(&mux_);
    return ok;
  }

  void pop() {
    portENTER_CRITICAL(&mux_);
    if (count_ > 0) {
      head_ = (head_ + 1) % EVENT_QUEUE_SIZE;
      count_--;
    }
    portEXIT_CRITICAL(&mux_);
  }

  uint8_t size() {
    portENTER_CRITICAL(&mux_);
    uint8_t n = count_;
    portEXIT_CRITICAL(&mux_);
    return n;
  }

  uint32_t dropped() const { return dropped_; }

 private:
  portMUX_TYPE mux_;
  Event buf_[EVENT_QUEUE_SIZE];
  uint8_t head_ = 0;
  uint8_t count_ = 0;
  uint32_t dropped_ = 0;
};
