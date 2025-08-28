import React, { ChangeEvent, ReactNode, forwardRef } from 'react';
import { 
  Input, 
  InputGroup, 
  InputProps, 
  InputGroupProps, 
  InputLeftElement, 
  InputRightElement,
  IconButton,
  useColorModeValue,
  InputLeftAddon,
  InputRightAddon
} from '@chakra-ui/react';
import { SearchIcon, SmallCloseIcon } from '@chakra-ui/icons';

type InputVariant = 'outline' | 'filled' | 'flushed' | 'unstyled';

type InputWithIconV2Props = {
  /** The current value of the input */
  value: string;
  /** Callback when input value changes */
  onChange: (value: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Icon to display on the left side of the input */
  leftIcon?: ReactNode;
  /** Icon to display on the right side of the input */
  rightIcon?: ReactNode;
  /** Text to display as left addon */
  leftAddon?: ReactNode;
  /** Text to display as right addon */
  rightAddon?: ReactNode;
  /** Show clear button when input has value */
  showClearButton?: boolean;
  /** Custom clear button icon */
  clearButtonIcon?: ReactNode;
  /** Callback when clear button is clicked */
  onClear?: () => void;
  /** Input variant */
  variant?: InputVariant;
  /** Additional input props */
  inputProps?: Omit<InputProps, 'onChange' | 'value' | 'placeholder' | 'variant'>;
} & Omit<InputGroupProps, 'children' | 'onChange'>;

/**
 * A customizable input component with icon support, clear button, and addons.
 * Built on top of Chakra UI's Input component with enhanced functionality.
 */
export const InputWithIconV2 = forwardRef<HTMLInputElement, InputWithIconV2Props>(({
  value,
  onChange,
  placeholder = 'Search...',
  leftIcon = <SearchIcon color="gray.400" />,
  rightIcon,
  leftAddon,
  rightAddon,
  showClearButton = true,
  clearButtonIcon = <SmallCloseIcon />,
  onClear,
  variant = 'outline',
  inputProps = {},
  ...props
}, ref) => {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  const handleClear = () => {
    onChange('');
    onClear?.();
  };

  const showClearBtn = showClearButton && value && !inputProps.isDisabled && !inputProps.isReadOnly;
  const defaultIconColor = useColorModeValue('gray.500', 'gray.400');
  const clearButtonColor = useColorModeValue('gray.400', 'gray.500');

  return (
    <InputGroup {...props}>
      {leftAddon && <InputLeftAddon>{leftAddon}</InputLeftAddon>}
      
      {leftIcon && (
        <InputLeftElement pointerEvents="none" color={defaultIconColor}>
          {leftIcon}
        </InputLeftElement>
      )}

      <Input
        ref={ref}
        type="text"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        variant={variant}
        pl={leftIcon ? '2.5rem' : undefined}
        pr={showClearBtn || rightIcon ? '2.5rem' : undefined}
        {...inputProps}
      />

      {(showClearBtn || rightIcon) && (
        <InputRightElement>
          {showClearBtn ? (
            <IconButton
              size="xs"
              variant="ghost"
              color={clearButtonColor}
              aria-label="Clear input"
              icon={clearButtonIcon}
              onClick={handleClear}
              _hover={{ color: 'gray.600' }}
              _active={{ bg: 'transparent' }}
            />
          ) : (
            rightIcon
          )}
        </InputRightElement>
      )}
      
      {rightAddon && <InputRightAddon>{rightAddon}</InputRightAddon>}
    </InputGroup>
  );
});

InputWithIconV2.displayName = 'InputWithIconV2';
